# Use Archify Custom in the ChatGPT app

Codex is not required to use a Skill in ChatGPT when your account and workspace support Skills. This page describes the intended upload path for Archify Custom. **Uploading and running this specific ZIP inside ChatGPT have not yet been tested.**

## Check access and upload

OpenAI documents Skills for eligible ChatGPT Business, Enterprise, Healthcare, and Edu users. Access depends on workspace settings and product availability. In ChatGPT, open **Plugins → Skills → Create → Upload from your computer**. If these controls are missing, check your workspace permissions and feature availability. ChatGPT scans uploaded Skills before making them available. See [OpenAI's Skills in ChatGPT guide](https://help.openai.com/en/articles/20001066-skills-in-chatgpt) for current controls and eligibility.

1. Download **archify.zip** from [this fork's latest release](https://github.com/Nhat-Bui-CGI/archify-custom/releases/latest). Use the release asset rather than GitHub's source-code archive.
2. Select the ZIP in ChatGPT's Skill upload flow. Follow any scan, review, or installation steps shown by ChatGPT.
3. Confirm that Archify is available in your Skills list before trying it in a chat.

Uploading a ZIP as an ordinary chat attachment or project reference file does not, by itself, establish that it is installed as a Skill.

## Check execution support

Archify's renderer runs with Node.js. Its complete `finalize` workflow also needs a supported Chrome/Chromium browser for browser checks. The ZIP includes Archify's runtime dependencies; it does not include the Node.js or browser executables.

Ask ChatGPT to check the available environment before generating a diagram:

```text
Use Archify Custom to draw a small Azure integration:
Partner application → API Management → Logic Apps → Service Bus → Azure Functions.

First check whether Node.js and a supported browser are available to Archify.
Use the official Azure icons with the package's default badge size.
Return the standalone HTML and report which validation and browser checks
actually completed. If the environment cannot run the renderer or a check,
explain the missing capability rather than claiming it passed.
```

The release has been tested through its command-line renderer and browser checks on Windows. That evidence does not establish that ChatGPT's execution environment can run the same workflow. Node.js availability enables generation; browser availability determines whether full browser verification can run.

## Update the uploaded Skill

Download the new **archify.zip** from [this fork's releases](https://github.com/Nhat-Bui-CGI/archify-custom/releases). Use the Skill management controls available in your ChatGPT workspace to replace the uploaded version. Preserve any personal edits first, and check that an older copy is not also enabled.

The [local harness install and update prompts](zip-installation.md#let-your-harness-do-it) manage filesystem installations. They are separate from ChatGPT's uploaded-Skill management. Built-in upstream update reminders do not track this fork's custom releases.

## Open a diagram someone has already created

Download the generated `.html` file and open it in a browser. The standalone viewer works without Codex, a ChatGPT Skill installation, or Node.js. Node.js is needed to regenerate the diagram from its source.
