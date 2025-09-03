# Kinshi Tunes

> A dedicated open-source music bot based on [@rawon](https://github.com/stegripe/rawon), designed for personal use and development.

<a href="https://github.com/pizzarous/kinshi-tunes/actions?query=workflow%3A%22Lint+code+and+compile+setup+script%22"><img src="https://github.com/pizzarous/kinshi-tunes/workflows/Lint%20code%20and%20compile%20setup%20script/badge.svg" alt="CI Status" /></a>

## Features

-   **Multi-Platform Music Support:** YouTube, SoundCloud, and Spotify integration
-   **Advanced Audio Processing:** FFmpeg-based audio filters and effects
-   **Slash Commands & Prefix Support:** Modern Discord interactions with fallback support
-   **Queue Management:** Play, pause, skip, shuffle, repeat, and more
-   **Voice Channel Controls:** Auto-join, auto-leave, and voice state management
-   **Moderation Tools:** Ban, kick, mute, warn, and purge commands
-   **Production-Ready:** Optimized for self-hosting with comprehensive error handling

## General Setup

1. **Download and Install Node.js:** Ensure you have version `16.6.0` or higher. [Node.js Download](https://nodejs.org)
2. **Download and Install Python:** Ensure you have version `3.12.6`.
3. **Configure Environment Variables:** Copy `.env.example` to `.env` and configure your Discord token and other settings.
4. **Install Dependencies:** Run the following command in your terminal.
    ```sh
    $ npm install
    ```
5. **Build the Project:**
    ```sh
    $ npm run build
    ```
6. **Start the Bot:**
    ```sh
    $ npm start
    ```

### Development
For development with automatic compilation:
```sh
$ npm run start:dev
```

## Disclaimers

Please review the disclaimers listed in [DISCLAIMERS.md](./DISCLAIMERS.md).

## License

Kinshi Tunes is released under the [BSD 3-Clause License](https://github.com/Pizzarous/Kinshi-Tunes/blob/main/LICENSE). Feel free to use, modify, and distribute the software according to the outlined conditions. For detailed terms, refer to the [LICENSE](https://github.com/Pizzarous/Kinshi-Tunes/blob/main/LICENSE) file.

> © 2023 Pizzarous Development | [GitHub Repository](https://github.com/pizzarous/kinshi-tunes)
