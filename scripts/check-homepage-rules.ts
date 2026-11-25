import assert from "node:assert/strict";
import { createElement } from "react";
import { Route } from "react-router-dom";
import { configuredHomePaths, DEFAULT_HOME_PATH } from "../src/lib/site/homepageChoices";
import { isHomeRoute } from "../src/lib/site/homeRoutes";

// Legacy built-in settings are one page, never a randomly assigned split page.
assert.equal(DEFAULT_HOME_PATH, "/landing6");
assert.deepEqual(configuredHomePaths({ mode: "builtin" }), ["/landing6"]);
assert.deepEqual(configuredHomePaths(), ["/landing6"]);

// HQ must retain the explicitly selected page, including older published settings.
assert.deepEqual(configuredHomePaths({ mode: "path", path: "/landing5" }), ["/landing5"]);
assert.deepEqual(configuredHomePaths({ mode: "single", page: { kind: "react", page: "glass" } }), ["/landing-glass"]);
assert.deepEqual(configuredHomePaths({ mode: "test", arms: [
  { page: { kind: "path", path: "/landing6" } }, { page: { kind: "path", path: "/landing5" } },
] }), ["/landing6", "/landing5"]);

// Unknown addresses cannot be applied and silently fall back to another design.
const routes = ["/", "/landing6", "/for-schools", "/hq", "*"].map((path) => createElement(Route, { key: path, path, element: createElement("div") }));
assert.equal(isHomeRoute(routes, "/landing6"), true);
assert.equal(isHomeRoute(routes, "/for-schools"), true);
assert.equal(isHomeRoute(routes, "/landing99"), false);
assert.equal(isHomeRoute(routes, "/hq"), false);
assert.equal(isHomeRoute(routes, "/"), false);
console.log("Homepage default, explicit choices, optional tests and existing-page validation: passed");