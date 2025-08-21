# Kinshi Tunes

> A dedicated open-source music bot based on [@rawon](https://github.com/stegripe/rawon), designed for personal use and development.

<a href="https://github.com/pizzarous/kinshi-tunes/actions?query=workflow%3A%22Lint+code+and+compile+setup+script%22"><img src="https://github.com/pizzarous/kinshi-tunes/workflows/Lint%20code%20and%20compile%20setup%20script/badge.svg" alt="CI Status" /></a>

## Features

-   **Interaction Support:** Engage with the bot.
-   **Configurable and Easy to Use:** Customize the bot according to your needs.
-   **Basic Music and Moderation Commands:** Enjoy essential functionalities.
-   **Production-Ready Project:** Set up the bot without coding.

## General Setup

1. **Download and Install Node.js:** Ensure you have version `16.6.0` or higher. [Node.js Download](https://nodejs.org)
2. **Download and Install Python:** Ensure you have version `3.12.6`.
3. **Configure Environment Variables:** Open `.env_example`, rename it to `.env`.
4. **Install Dependencies:** Run the following command in your terminal.
    ```sh
    $ pnpm install
    ```
5. **Compile the Code:** Execute the build script.
    ```sh
    $ pnpm run build
    ```
6. **Optimize Disk Space:** Remove unnecessary dev dependencies.
    ```sh
    $ pnpm prune --production
    ```
7. **Start the Bot:** Launch the bot with the following command.
    ```sh
    $ pnpm start
    ```

## Disclaimers

Please review the disclaimers listed in [DISCLAIMERS.md](./DISCLAIMERS.md).

## License

Kinshi Tunes is released under the [BSD 3-Clause License](https://github.com/Pizzarous/Kinshi-Tunes/blob/main/LICENSE). Feel free to use, modify, and distribute the software according to the outlined conditions. For detailed terms, refer to the [LICENSE](https://github.com/Pizzarous/Kinshi-Tunes/blob/main/LICENSE) file.

> © 2023 Pizzarous Development | [GitHub Repository](https://github.com/pizzarous/kinshi-tunes)
