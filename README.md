# Redmine Epic Ladder

VS Code extension for Redmine ticket management with hierarchical Epic/Feature/UserStory view.

## Features

- **Epic Ladder View**: Visualize your project structure with Epic > Feature > UserStory > Task/Bug/Test hierarchy
- **Tree View**: Browse Redmine issues in a tree structure
- **Issue Details**: View ticket details including status, assignee, priority, and description
- **Quick Actions**:
  - Add comments to issues
  - Change issue status
  - Open issues in browser
- **Filtering**: Filter issues by version, status, and assignee
- **Version Management**: View issues organized by sprint/version

## Requirements

This extension requires a running Redmine MCP Server. The MCP Server provides the bridge between VS Code and your Redmine instance.

### Setting up the MCP Server

1. Clone and set up the [redmine-epic-grid](https://github.com/hollySizzle/redmine-epic-grid) MCP server
2. Configure the MCP server with your Redmine URL and API key
3. Start the MCP server

## Installation

### From Visual Studio Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Redmine Epic Ladder"
4. Click Install

### Manual Installation

1. Download the `.vsix` file from [Releases](https://github.com/hollySizzle/epic_ladder_for_vsc/releases)
2. In VS Code, open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file

## Configuration

Configure the extension in VS Code Settings:

```json
{
  "redmine.url": "https://your-redmine-server.com",
  "redmine.apiKey": "your-api-key",
  "redmine.defaultProject": "your-project-identifier"
}
```

### Settings

| Setting | Description | Required |
|---------|-------------|----------|
| `redmine.url` | Redmine server URL | Yes |
| `redmine.apiKey` | Redmine API key | Yes |
| `redmine.defaultProject` | Default project identifier | No |

### Getting Your API Key

1. Log in to your Redmine instance
2. Go to My Account (top right menu)
3. Click "Show" under API access key on the right sidebar
4. Copy the API key

## Usage

### Opening Epic Ladder View

1. Click the Redmine icon in the Activity Bar (left sidebar)
2. Click the tree icon in the view title bar to open Epic Ladder

### Viewing Issue Details

- Click on any issue in the tree view or Epic Ladder to see its details
- Use the popup panel to view comments, add new comments, or change status

### Filtering Issues

In the Epic Ladder view:
- Select a Version/Sprint to filter by release
- Toggle status filters (Open/Closed)
- Filter by assignee

## Commands

| Command | Description |
|---------|-------------|
| `Redmine: Refresh` | Refresh the issue list |
| `Redmine: Open Issue Details` | Open issue by entering ID |
| `Redmine: Configure Redmine Connection` | Open settings |
| `Redmine: Show Epic Ladder` | Open the Epic Ladder view |

## Project Structure

This extension follows the Epic > Feature > UserStory > Task/Bug/Test hierarchy:

```
Epic (Large initiative)
  └── Feature (Grouping)
        └── UserStory (User requirement)
              ├── Task (Implementation work)
              ├── Bug (Defect)
              └── Test (Verification)
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

### Publishing to Marketplace

This extension uses GitHub Actions for automated publishing. When a version tag is pushed, the extension is automatically published to the VS Code Marketplace.

#### Setup

1. Create a Personal Access Token (PAT) in [Azure DevOps](https://dev.azure.com/)
   - Organization: `All accessible organizations`
   - Scope: `Marketplace > Manage`
2. Add the PAT as a secret named `VSCE_PAT` in the GitHub repository settings

#### Publishing a New Version

1. Update `version` in `package.json`
2. Commit the changes
3. Create and push a version tag:

```bash
git tag v0.1.3
git push origin v0.1.3
```

The GitHub Action will automatically build and publish the extension.

## Support

- [GitHub Issues](https://github.com/hollySizzle/epic_ladder_for_vsc/issues)
