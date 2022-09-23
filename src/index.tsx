import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WithMetaframeAndInputs } from "@metapages/metaframe-hook";
import { ChakraProvider } from "@chakra-ui/react";
import { App } from "./App";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <StrictMode>
    <ChakraProvider>
      <WithMetaframeAndInputs>
        <App />
      </WithMetaframeAndInputs>
    </ChakraProvider>
  </StrictMode>
);
