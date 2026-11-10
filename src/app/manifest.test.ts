import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("installing Annora as an app (INSTALL)", () => {
  const m = manifest();

  it("opens in its own window, straight at Inicio (INSTALL-1)", () => {
    expect(m.name).toBe("Annora");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/dashboard");
  });

  it("has the icons browsers ask for to install it (INSTALL-1)", () => {
    const icons = m.icons ?? [];
    const pngs = icons.filter((i) => i.type === "image/png");
    expect(pngs.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
