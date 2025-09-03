# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Compilation
- `npm run build` - Lints and compiles TypeScript to JavaScript (runs lint + compile)
- `npm run compile` - Compiles TypeScript using SWC to dist/ directory
- `npm run tscompile` - Alternative TypeScript compilation using tsc

### Code Quality
- `npm run lint` - Run ESLint with caching
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run pretty` - Check code formatting with Prettier
- `npm run pretty:write` - Format code with Prettier

### Running the Bot
- `npm start` - Start the production bot (requires compiled code in dist/)
- `npm run start:dev` - Clean, compile, and start for development

## Architecture Overview

### Core Structure
- **Main Entry**: `src/index.ts` - Sets up Discord.js ShardingManager for scalability
- **Bot Entry**: `src/bot.ts` - Initializes the KinshiTunes client
- **Client Class**: `src/structures/KinshiTunes.ts` - Main bot class extending Discord.js Client

### Command System
- Commands use TypeScript decorators for metadata and validation
- Base class: `src/structures/BaseCommand.ts` - All commands extend this
- Decorator: `src/utils/decorators/Command.ts` - Provides command metadata
- Music decorators: `src/utils/decorators/MusicUtil.ts` - Voice channel validations (@inVC, @sameVC, @validVC)
- Command categories: `commands/music/`, `commands/moderation/`, `commands/general/`, `commands/developers/`

### Music System
- Queue management via `src/structures/ServerQueue.ts`
- Song handling through `src/utils/structures/SongManager.ts`
- Multiple audio sources: YouTube (youtubei, youtube-dl-exec), SoundCloud, Spotify integration
- Voice connection handling with @discordjs/voice

### Event System
- Events in `src/events/` directory
- Base class: `src/structures/BaseEvent.ts`
- Event loader: `src/utils/structures/EventsLoader.ts`

### Data Management
- JSON-based data storage via `src/utils/structures/JSONDataManager.ts`
- Guild-specific data stored in `data.json`
- Configuration in `src/config/` with environment variable parsing

### Utilities
- Logger: `src/utils/structures/Logger.ts` - Production/development aware logging
- Debug logging: `src/utils/structures/DebugLogManager.ts` - Detailed debug information
- Moderation logs: `src/utils/structures/ModerationLogs.ts`
- HTTP client: Extended `got` instance with hooks in KinshiTunes class

## Configuration

### Environment Setup
- Copy `dev.env.example` to `.env` for development configuration
- Required: `DISCORD_TOKEN`
- Optional: `DEVS`, `NODE_ENV`, `DEBUG_MODE`, `REPL`

### Internationalization
- i18n support with locales in `lang/` directory
- Default: English, also supports Spanish
- Usage: `i18n.__("key.path")` in commands

## Code Conventions

### TypeScript Configuration
- Target: ES2022 with NodeNext modules
- Strict mode enabled with decorators support
- Output: `dist/` directory
- Custom type definitions in `src/typings/`

### ESLint Rules
- TypeScript-specific rules with explicit return types required
- Prettier integration for formatting
- Naming conventions: camelCase/PascalCase with flexibility
- Error prevention: floating promises, optional chaining preferred

### Code Style
- Tab width: 4 spaces
- No trailing commas
- Arrow functions without parentheses when possible
- Print width: 120 characters

## Music System Architecture

### Audio Processing
- FFmpeg integration via `fluent-ffmpeg` and `ffmpeg-static`
- Multiple audio filters support
- Voice connection management through Discord.js Voice
- Audio streaming from various sources

### Search and Playback
- Multi-platform search: YouTube, SoundCloud, Spotify
- Playlist support and queue management  
- Audio filters and effects
- Volume control and playback controls (pause, skip, etc.)