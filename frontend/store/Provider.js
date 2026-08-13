"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import { store } from "./index";
import { hydrate } from "./authSlice";

export default function ReduxProvider({ children }) {
  useEffect(() => { store.dispatch(hydrate()); }, []);
  return <Provider store={store}>{children}</Provider>;
}
