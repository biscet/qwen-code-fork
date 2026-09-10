import json
import sys
from pathlib import Path

from serena.cli import top_level
from serena.config.serena_config import ProjectConfig, SerenaConfig
from serena.util.file_system import GitignoreParser, scan_directory
from serena.util.yaml import save_yaml
from solidlsp.ls_config import LanguageServerId

runtime = Path(__file__).resolve().parent
node = str(runtime.parent / "node" / "bin" / "node")
config = SerenaConfig.from_config_file()
marker = Path(config.config_file_path).with_name(".homecode-language-servers.json")
previous = json.loads(marker.read_text()) if marker.exists() else {}
managed = {}
changed = False
for language, script in {
    "typescript": "typescript-language-server/lib/cli.mjs",
    "python": "pyright/langserver.index.js",
}.items():
    settings = config.ls_specific_settings.setdefault(language, {})
    command = [node, str(runtime / "node_modules" / script)]
    current = settings.get("ls_base_cmd")
    if (current is None and "ls_path" not in settings) or (
        current is not None and current == previous.get(language)
    ):
        managed[language] = command
        if current != command:
            settings["ls_base_cmd"] = command
            changed = True
if changed:
    config._save()
if managed != previous:
    marker.write_text(json.dumps(managed) + "\n")

project = Path.cwd()
project_config_path = config.get_project_yml_location(str(project))
if sys.argv[1:2] == ["start-mcp-server"] and not Path(project_config_path).exists():
    ignored = GitignoreParser(str(project))
    files = scan_directory(
        str(project),
        recursive=True,
        is_ignored_dir=lambda directory: (
            Path(directory).name in {".git", ".qwen", ".serena"}
            or ignored.should_ignore(directory)
        ),
        is_ignored_file=ignored.should_ignore,
    ).files
    matchers = [
        language.get_source_fn_matcher()
        for language in LanguageServerId.iter_all(include_experimental=False)
    ]
    if not any(
        matcher.is_relevant_filename(Path(file).name)
        for file in files
        for matcher in matchers
    ):
        initial = ProjectConfig.autogenerate(
            project,
            config,
            languages=[LanguageServerId.TYPESCRIPT, LanguageServerId.PYTHON],
            save_to_disk=False,
        )
        save_yaml(project_config_path, initial._to_yaml_dict())
top_level()
