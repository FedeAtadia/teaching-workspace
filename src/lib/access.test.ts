import { describe, expect, it } from "vitest";
import { routeFor } from "./access";

describe("who can open what (LAND)", () => {
  it("lets anyone not signed in open the home page (LAND-1)", () => {
    expect(routeFor("/", false)).toBeNull();
  });

  it("lets anyone not signed in sign in (LAND-1)", () => {
    expect(routeFor("/login", false)).toBeNull();
    expect(routeFor("/auth/callback", false)).toBeNull();
  });

  it("sends anyone not signed in from every other page to sign-in (LAND-1)", () => {
    expect(routeFor("/dashboard", false)).toBe("/login");
    expect(routeFor("/classes/abc", false)).toBe("/login");
    expect(routeFor("/settings", false)).toBe("/login");
    // The home page is public by exact match, not as a prefix of everything.
    expect(routeFor("/x", false)).toBe("/login");
  });

  it("sends a signed-in teacher from the home page and sign-in to Inicio (LAND-2)", () => {
    expect(routeFor("/", true)).toBe("/dashboard");
    expect(routeFor("/login", true)).toBe("/dashboard");
  });

  it("lets a signed-in teacher finish signing in and open the app (LAND-2)", () => {
    expect(routeFor("/auth/callback", true)).toBeNull();
    expect(routeFor("/dashboard", true)).toBeNull();
    expect(routeFor("/classes/abc", true)).toBeNull();
  });

  it("lets anyone read what installing the app needs (INSTALL-2)", () => {
    expect(routeFor("/manifest.webmanifest", false)).toBeNull();
    expect(routeFor("/manifest.webmanifest", true)).toBeNull();
  });
});
