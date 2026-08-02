/** Spotify embed URL helper */
export function toEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("spotify.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "playlist" || parts[0] === "album" || parts[0] === "track") {
        return "https://open.spotify.com/embed/" + parts[0] + "/" + parts[1];
      }
    }
  } catch (e) {}
  return url;
}
