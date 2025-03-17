/* eslint-disable @typescript-eslint/naming-convention */
import { KinshiTunes } from "../../structures/KinshiTunes.js";
import { SpotifyAlbum, SpotifyPlaylist, SpotifyTrack } from "../../typings/index.js";

export class SpotifyUtil {
    public spotifyRegex = /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|album)[/:]([A-Za-z0-9]+)/;
    public baseURI = "https://api.spotify.com/v1";
    private token!: string;

    public constructor(public client: KinshiTunes) {}

    public async fetchToken(): Promise<number> {
        try {
            // Get credentials from your config
            const clientId = process.env.SPOTIFY_CLIENT_ID ?? "";
            const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? "";

            if (!clientId || !clientSecret) {
                console.warn("[WARN] Spotify credentials not configured. Spotify features will be disabled.");
                return 60000; // Try again in a minute
            }

            // Use the client_credentials flow
            const response = await this.client.request
                .post("https://accounts.spotify.com/api/token", {
                    form: {
                        grant_type: "client_credentials",
                        client_id: clientId,
                        client_secret: clientSecret
                    },
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                })
                .json<{ access_token: string; expires_in: number }>();

            if (!response.access_token) {
                throw new Error("Failed to obtain Spotify access token");
            }

            this.token = `Bearer ${response.access_token}`;
            console.info("[INFO] Spotify token obtained successfully");

            // Default to 1 hour (3600 seconds) if expires_in isn't present
            const expiresIn = response.expires_in || 3600;
            return expiresIn * 1000 - 60000; // Subtract a minute for safety
        } catch (error) {
            console.error("[ERROR] Failed to fetch Spotify token:", error);
            return 60000; // Try again in a minute
        }
    }

    public async renew(): Promise<void> {
        try {
            const tokenLifetime = await this.fetchToken();
            // Schedule the next renewal
            setTimeout(() => this.renew(), tokenLifetime);
            console.info(`[INFO] Spotify token renewed, next renewal in ${Math.floor(tokenLifetime / 60000)} minutes`);
        } catch (error) {
            console.error("[ERROR] Error in Spotify token renewal:", error);
            // Try again in a minute
            setTimeout(() => this.renew(), 60000);
            console.warn("[WARN] Will retry Spotify token renewal in 1 minute");
        }
    }

    public resolveTracks(url: string): Promise<{ track: SpotifyTrack }[]> | Promise<SpotifyTrack> | undefined {
        const [, type, id] = this.spotifyRegex.exec(url) ?? [];
        switch (type) {
            case "track": {
                return this.getTrack(id);
            }

            case "playlist": {
                return this.getPlaylist(id);
            }

            case "album": {
                return this.getAlbum(id);
            }
        }
    }

    public async getAlbum(id: string): Promise<{ track: SpotifyTrack }[]> {
        const albumResponse = await this.client.request
            .get(`${this.baseURI}/albums/${id}`, {
                headers: {
                    Authorization: this.token
                }
            })
            .json<SpotifyAlbum>();
        let next = albumResponse.tracks.next;
        while (next) {
            const nextPlaylistResponse = await this.client.request
                .get(next, {
                    headers: {
                        Authorization: this.token
                    }
                })
                .json<SpotifyAlbum["tracks"]>();
            next = nextPlaylistResponse.next;
            albumResponse.tracks.items.push(...nextPlaylistResponse.items);
        }
        return albumResponse.tracks.items.filter(Boolean).map(track => ({ track }));
    }

    public async getPlaylist(id: string): Promise<{ track: SpotifyTrack }[]> {
        const playlistResponse = await this.client.request
            .get(`${this.baseURI}/playlists/${id}`, {
                headers: {
                    Authorization: this.token
                }
            })
            .json<SpotifyPlaylist>();
        let next = playlistResponse.tracks.next;
        while (next) {
            const nextPlaylistResponse = await this.client.request
                .get(next, {
                    headers: {
                        Authorization: this.token
                    }
                })
                .json<SpotifyPlaylist["tracks"]>();
            next = nextPlaylistResponse.next;
            playlistResponse.tracks.items.push(...nextPlaylistResponse.items);
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return playlistResponse.tracks.items.filter(spotifyTrack => spotifyTrack.track);
    }

    public getTrack(id: string): Promise<SpotifyTrack> {
        return this.client.request
            .get(`${this.baseURI}/tracks/${id}`, {
                headers: {
                    Authorization: this.token
                }
            })
            .json<SpotifyTrack>();
    }
}
