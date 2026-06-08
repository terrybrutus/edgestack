import { Outlet, createRootRoute, createRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { Layout } from "./components/Layout";
import ItemsPage from "./pages/ItemsPage";

const rootRoute = createRootRoute({
  component: () => createElement(Layout, null, createElement(Outlet, null)),
});

const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ItemsPage,
});

export const routeTree = rootRoute.addChildren([itemsRoute]);
