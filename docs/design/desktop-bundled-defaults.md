# Desktop bundled defaults

HomeCode currently packages the CLI's built-in skills and agents, but the additional capabilities visible in this checkout live in project files and personal settings. A DMG therefore cannot reproduce that inventory on a clean Mac.

Package a reviewed, secret-free desktop default settings file and the tracked project skill/agent assets. Initialize missing user configuration before the desktop daemon starts, using the CLI's resolved QWEN_HOME. Existing settings, provider definitions, MCP configurations and user skill/agent files take precedence. Record installation once so a restart does not undo an intentional deletion or disablement. Resolve skill helper references to the installed user skill directory.

This Mac is the server. Node REPL, Serena, Home AI Research and Qwen 27B run here; the DMG contains HTTPS connection settings for https://biscet-server.local:9454. An authenticated loopback gateway fronts the existing model/search services and server-side MCP runtimes behind Caddy TLS. All four connections use the user-provided LOCAL_QWEN_API_KEY; the gateway supplies its own existing research credential internally. The public Home AI LAN CA is bundled and added only to the desktop Node runtime trust, retaining any existing extra CA certificates. No local MCP executables are shipped to the second Mac. Serena file paths and Node REPL processes refer to the server. Preserve Qwen's 131072 context and current generation settings. Do not embed personal settings, tokens, history, or repository trust decisions.

Changes are limited to desktop packaging/default assets, the desktop startup hook, focused release/default tests, documentation, and desktop version manifests. Existing unrelated working changes remain part of the requested current build. No CLI-wide defaults or model weights are added. The generated DMG uses the existing local ad-hoc signing workflow.

Verification covers a clean QWEN_HOME outside the checkout, a populated profile, repeated startup, relocation, no-secret package inspection, authenticated management endpoints, local MCP tools, native app startup, resource signatures, and DMG integrity.
