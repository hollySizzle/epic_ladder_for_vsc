# Changelog

All notable changes to the "Redmine Epic Ladder" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-12-17

### Changed
- Webpack bundling for stable dependency management
- Package size reduced from 812KB to 82KB (90% reduction)

## [0.1.3] - 2025-12-17

### Added
- GitHub Actions CI/CD for automatic Marketplace publishing

## [0.1.2] - 2025-12-17

### Fixed
- Fixed missing axios dependencies in VSIX package (form-data, follow-redirects, etc.)

## [0.1.1] - 2025-12-17

### Fixed
- Fixed activation events to properly register commands on extension load

## [0.1.0] - 2025-12-17

### Added
- Initial release
- Epic Ladder webview with hierarchical structure visualization (Epic > Feature > UserStory > Task/Bug/Test)
- Tree view for browsing Redmine issues
- Issue detail popup with comments display
- Add comments to issues
- Change issue status (In Progress, Closed)
- Open issues in browser
- Filter by version/sprint
- Filter by status (Open/Closed)
- Filter by assignee
- VS Code settings integration for Redmine URL, API key, and default project
