use regex::Regex;
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const LOG_TAIL_BYTES: u64 = 8 * 1024 * 1024;

fn previous_log(path: &Path) -> PathBuf {
    path.with_file_name("desktop-runtime.previous.log")
}

fn read_tail(path: &Path, limit: u64) -> io::Result<Option<(String, bool)>> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let length = file.metadata()?.len();
    let offset = length.saturating_sub(limit);
    file.seek(SeekFrom::Start(offset))?;
    let mut bytes = Vec::new();
    file.take(limit).read_to_end(&mut bytes)?;
    // A tail may start inside a UTF-8 character or log record.
    if offset > 0 {
        if let Some(newline) = bytes.iter().position(|byte| *byte == b'\n') {
            bytes.drain(..=newline);
        } else {
            let first = bytes
                .iter()
                .position(|byte| byte & 0xc0 != 0x80)
                .unwrap_or(bytes.len());
            bytes.drain(..first);
        }
    }
    Ok(Some((
        String::from_utf8_lossy(&bytes).into_owned(),
        offset > 0,
    )))
}

pub fn prepare_log(path: &Path) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    if let Some((contents, truncated)) = read_tail(path, LOG_TAIL_BYTES)? {
        if !contents.is_empty() {
            let prefix = if truncated {
                "[Earlier log content omitted]\n"
            } else {
                ""
            };
            fs::write(previous_log(path), format!("{prefix}{contents}"))?;
        }
    }
    fs::write(path, b"")
}

fn redact(contents: &str) -> String {
    let mut result = contents.to_string();
    for (pattern, replacement) in [
        (r"(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+", "${1}<redacted>"),
        (r"(?im)(authorization:[ \t]*)[^\r\n]+", "${1}<redacted>"),
        (
            r#"(?i)((?:authorization|api[_-]?key|[a-z0-9_]*token|[a-z0-9_]*secret|password|pwd)[\"']?\s*[=:]\s*)(?:\"[^\"\r\n]*\"|'[^'\r\n]*'|[^\s&,}]+)"#,
            "${1}<redacted>",
        ),
        (r"sk-[a-zA-Z0-9-]{20,}", "sk-<redacted>"),
        (
            r"(?i)([a-z][a-z0-9+.-]{0,31}://)[^/\s@]+@",
            "${1}<redacted>@",
        ),
    ] {
        result = Regex::new(pattern)
            .expect("fixed credential pattern")
            .replace_all(&result, replacement)
            .into_owned();
    }
    result
}

pub fn export_logs(path: &Path, version: &str) -> io::Result<String> {
    let exported_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let mut output = format!(
        "HomeCode {version} diagnostics\nPlatform: {} / {}\nExported at (Unix seconds): {exported_at}\nRecent runtime logs; each section is limited to 8 MiB.\n\n",
        std::env::consts::OS, std::env::consts::ARCH,
    );
    for (label, file) in [
        ("Previous application launch", previous_log(path)),
        ("Current application launch", path.to_path_buf()),
    ] {
        output.push_str(&format!("=== {label} ===\n"));
        match read_tail(&file, LOG_TAIL_BYTES)? {
            Some((contents, truncated)) => {
                if truncated {
                    output.push_str("[Earlier log content omitted]\n");
                }
                output.push_str(&redact(&contents));
                output.push('\n');
            }
            None => output.push_str("[Log is not available]\n"),
        }
        output.push('\n');
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path() -> PathBuf {
        std::env::temp_dir()
            .join(format!(
                "homecode-log-test-{}-{}",
                std::process::id(),
                rand::random::<u64>()
            ))
            .join("desktop-runtime.log")
    }

    #[test]
    fn retains_previous_launch_and_keeps_it_across_an_empty_launch() {
        let path = test_path();
        prepare_log(&path).unwrap();
        fs::write(&path, "prior failure\n").unwrap();
        prepare_log(&path).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "");
        prepare_log(&path).unwrap();
        fs::write(&path, "new launch\n").unwrap();
        let exported = export_logs(&path, "test-version").unwrap();
        assert!(exported.contains("HomeCode test-version"));
        assert!(exported.contains("prior failure"));
        assert!(exported.contains("new launch"));
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn failed_preservation_does_not_clear_current_log() {
        let path = test_path();
        prepare_log(&path).unwrap();
        fs::write(&path, "failure evidence").unwrap();
        fs::create_dir(previous_log(&path)).unwrap();
        assert!(prepare_log(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "failure evidence");
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn reads_a_bounded_tail_on_a_complete_line() {
        let path = test_path();
        prepare_log(&path).unwrap();
        fs::write(&path, "old line\nошибка\nnew failure\n").unwrap();
        let (tail, truncated) = read_tail(&path, 20).unwrap().unwrap();
        assert_eq!(tail, "new failure\n");
        assert!(truncated);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn missing_logs_are_reported() {
        let output = export_logs(&test_path(), "test").unwrap();
        assert_eq!(output.matches("[Log is not available]").count(), 2);
    }

    #[test]
    fn redacts_credentials_without_erasing_diagnostic_context() {
        let output = redact("Bearer abc.def\nAuthorization: Basic abc123\n{\"apiKey\":\"key-value\",\"access_token\":\"token-value\"}\nQWEN_SERVER_TOKEN=server-token\nhttps://user:pass@example.com/path?token=query-secret\nsk-123456789012345678901234\nrequestId=abc sessionId=def Error: read_file missing path\n");
        for secret in [
            "abc.def",
            "abc123",
            "key-value",
            "token-value",
            "server-token",
            "user:pass",
            "query-secret",
            "123456789012345678901234",
        ] {
            assert!(!output.contains(secret), "leaked {secret}: {output}");
        }
        assert!(output.contains("requestId=abc sessionId=def Error: read_file missing path"));
    }
}
