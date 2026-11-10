import type { MetadataRoute } from "next";

/**
 * What the browser needs to install Annora as an app (INSTALL-1): its own
 * window, the Teal nórdico mark (rendered from icon.svg into public/icons/),
 * and Inicio as the first screen; the proxy sends anyone not signed in to
 * sign-in from there. Served at /manifest.webmanifest, readable signed out
 * (INSTALL-2).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Annora",
    short_name: "Annora",
    description: "Cursos, estudiantes, notas y asistencia, en un solo lugar.",
    lang: "es-AR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b171b",
    theme_color: "#0b171b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
