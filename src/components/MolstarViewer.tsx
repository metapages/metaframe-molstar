import { useEffect, useRef, useState } from "react";

import { Viewer } from "molstar/lib/apps/viewer/app.js";
import { PluginCommands } from "molstar/lib/mol-plugin/commands";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { ColorNames } from "molstar/lib/mol-util/color/names";

import { Box, Flex } from "@chakra-ui/react";
import { useHashParam } from "@metapages/hash-query/react-hooks";

import { useMolstarOptions, ViewerOptions } from "./MolstarOptions";
import { MolstarSettingsButton } from "./MolstarSettingsButton";
import { useDebouncedMetaframeInputs } from "./useDebouncedMetaframeInputs";
import equal from "fast-deep-equal/es6";

// Build DefaultOptions - we need to merge with defaults when creating viewer
const buildDefaultOptions = (): Record<string, any> => {
  const defaults: Record<string, any> = {};
  ViewerOptions.forEach((option) => {
    if (option.default !== undefined) {
      defaults[option.name] = option.default;
    }
  });
  return defaults;
};
const DefaultOptions = buildDefaultOptions();

Object.defineProperty(navigator, "xr", {
  get: function () {
    return undefined;
  },
});

export const MolstarViewer: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  // @ts-ignore
  const refInstance = useRef<Viewer | null>(null);

  // Single state to track what molecule to display - prevents multiple useEffects from firing
  const [moleculeToDisplay, setMoleculeToDisplay] = useState<{
    type: "pdbId" | "pdbData" | "cifData" | "trajectory" | null;
    pdbId?: string;
    pdbData?: { data: string; isTrajectory?: boolean };
    cifData?: string | Blob | { data: string | Blob };
    xtcFile?: Blob;
    groFile?: Blob;
  } | null>(null);

  // Keep separate pdbId for hash param compatibility
  const [pdbId, setPdbId] = useState<string | undefined>();
  const [pdbIdFromHash, setMoleculeIdFromHash] = useHashParam(
    "pdbId",
    undefined
  );

  const [options, setOptions] = useMolstarOptions();

  const metaframeInputs = useDebouncedMetaframeInputs();

  // Update page background color when backgroundColor option changes
  // This prevents flickering when the viewer is recreated
  useEffect(() => {
    const backgroundColor =
      options.backgroundColor || DefaultOptions.backgroundColor || "white";
    const bgColor = backgroundColor === "white" ? "white" : "black";

    // Update the page background to prevent flickering
    document.body.style.backgroundColor = bgColor;
    const htmlElement = document.documentElement;
    if (htmlElement) {
      htmlElement.style.backgroundColor = bgColor;
    }

    // Cleanup: restore default on unmount
    return () => {
      document.body.style.backgroundColor = "";
      const htmlEl = document.documentElement;
      if (htmlEl) {
        htmlEl.style.backgroundColor = "";
      }
    };
  }, [options.backgroundColor]);

  // Load pdbId from separate hash parameter
  useEffect(() => {
    if (
      pdbIdFromHash &&
      typeof pdbIdFromHash === "string" &&
      pdbIdFromHash.trim() !== ""
    ) {
      const id = pdbIdFromHash.trim();
      // Only set if different from current pdbId to avoid unnecessary reloads
      if (pdbId !== id) {
        setPdbId(id);
        setMoleculeToDisplay({ type: "pdbId", pdbId: id });
      }
    } else if (
      (pdbIdFromHash === "" ||
        pdbIdFromHash === undefined ||
        pdbIdFromHash === null) &&
      pdbId
    ) {
      // Clear pdbId if pdbId is cleared
      setPdbId(undefined);
      setMoleculeToDisplay(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdbIdFromHash]); // Only depend on pdbIdFromHash to avoid loops

  // Single useEffect to handle all molecule display - prevents flashing
  const lastOptionsRef = useRef<Record<string, any>>();
  useEffect(() => {
    if (!moleculeToDisplay || !ref.current) {
      return;
    }

    const viewerContainer = ref.current;
    if (!viewerContainer) {
      return;
    }
    let cancelled = false;
    const disposers: (() => void)[] = [];
    (async () => {
      if (cancelled) {
        return;
      }

      // Merge options with defaults to ensure all options are present
      // This prevents Molstar from using its own defaults when options are filtered
      const mergedOptions = { ...DefaultOptions, ...options };

      if (
        !refInstance.current ||
        !equal(mergedOptions, lastOptionsRef.current)
      ) {
        refInstance.current?.dispose();
        // lastOptionsRef.current = mergedOptions;
        refInstance.current = await Viewer.create(viewerContainer, {
          ...mergedOptions,
          config: [
            [PluginConfig.Viewport.ShowXR, "never"], // Hide XR/VR icon
          ],
        });
        lastOptionsRef.current = mergedOptions;

        refInstance.current.plugin.canvas3d?.setProps({
          renderer: {
            backgroundColor:
              options.backgroundColor === "white"
                ? ColorNames.white
                : ColorNames.black,
          },
        });
      }

      const viewer = refInstance.current;

      // Get all current structures
      const allStructures =
        viewer.plugin.managers.structure.hierarchy.current.structures;

      // Remove all structures
      await viewer.plugin.managers.structure.hierarchy.remove(
        allStructures,
        true
      );

      if (moleculeToDisplay.type === "pdbId" && moleculeToDisplay.pdbId) {
        await viewer.loadPdb(moleculeToDisplay.pdbId);
      } else if (
        moleculeToDisplay.type === "pdbData" &&
        moleculeToDisplay.pdbData
      ) {
        const pdbBlob = new Blob([moleculeToDisplay.pdbData.data], {
          type: "text/plain",
        });
        const pdbUrl = URL.createObjectURL(pdbBlob);
        await viewer.loadStructureFromUrl(pdbUrl, "pdb");
      } else if (
        moleculeToDisplay.type === "cifData" &&
        moleculeToDisplay.cifData
      ) {
        let actualData: string | Blob;
        const cifData = moleculeToDisplay.cifData;
        if (cifData instanceof Blob) {
          actualData = cifData;
        } else if (typeof cifData === "string") {
          actualData = cifData;
        } else if (
          cifData &&
          typeof cifData === "object" &&
          "data" in cifData
        ) {
          actualData = cifData.data as string | Blob;
        } else {
          console.error("Invalid CIF data type:", typeof cifData, cifData);
          return;
        }

        let cifUrl: string;
        if (actualData instanceof Blob) {
          const text = await actualData.text();
          if (cancelled) {
            return;
          }
          const cifBlob = new Blob([text], {
            type: "text/plain; charset=utf-8",
          });
          cifUrl = URL.createObjectURL(cifBlob);
        } else {
          const cifBlob = new Blob([actualData], {
            type: "text/plain; charset=utf-8",
          });
          cifUrl = URL.createObjectURL(cifBlob);
        }

        try {
          await viewer.loadStructureFromUrl(cifUrl, "mmcif");
        } catch (error) {
          console.error("Error loading CIF file:", error);
          URL.revokeObjectURL(cifUrl);
        }
      } else if (
        moleculeToDisplay.type === "trajectory" &&
        moleculeToDisplay.xtcFile &&
        moleculeToDisplay.groFile
      ) {
        const xtcObjectUrl = URL.createObjectURL(moleculeToDisplay.xtcFile);
        const groObjectUrl = URL.createObjectURL(moleculeToDisplay.groFile);
        await viewer.loadTrajectory({
          model: { kind: "model-url", url: groObjectUrl, format: "gro" },
          coordinates: {
            kind: "coordinates-url",
            url: xtcObjectUrl,
            format: "xtc",
            isBinary: true,
          },
          preset: "default",
        });
      }
      // Reset camera after structure is loaded
      // To reset to the default view of the loaded structure
      await viewer.plugin.canvas3d?.requestCameraReset();
    })();

    return () => {
      cancelled = true;
      disposers.forEach((disposer) => disposer());
    };
  }, [moleculeToDisplay, options]);

  // handle metaframe inputs - process sequentially with debouncing
  useEffect(() => {
    if (!metaframeInputs || Object.keys(metaframeInputs).length === 0) {
      return;
    }

    const inputs = metaframeInputs;

    const keys = Object.keys(inputs);

    // Priority 1: pdb-id (direct ID lookup)
    for (const key of keys) {
      if (
        key === "pdb-id" ||
        key === "pdbid" ||
        key === "pdbId" ||
        key === "pdbID"
      ) {
        const value = inputs[key];
        setPdbId(value);
        setMoleculeToDisplay({ type: "pdbId", pdbId: value });
        return;
      }
    }

    // Priority 2: .pdb files
    for (const key of keys) {
      if (key.endsWith(".pdb")) {
        const value = inputs[key];
        setMoleculeToDisplay({
          type: "pdbData",
          pdbData: { data: value, isTrajectory: key.includes("traj") },
        });
        return;
      }
    }

    // Priority 3: .cif files
    for (const key of keys) {
      if (key.endsWith(".cif")) {
        const value = inputs[key];
        setMoleculeToDisplay({ type: "cifData", cifData: value });
        return;
      }
    }

    // Priority 4: trajectory files (need both .xtc and .gro)
    let xtcKey: string | undefined;
    let groKey: string | undefined;
    for (const key of keys) {
      if (key.endsWith(".xtc")) {
        xtcKey = key;
      } else if (key.endsWith(".gro")) {
        groKey = key;
      }
    }
    if (xtcKey && groKey) {
      const xtcValue = inputs[xtcKey];
      const groValue = inputs[groKey];
      setMoleculeToDisplay({
        type: "trajectory",
        xtcFile: xtcValue,
        groFile: groValue,
      });
      return;
    }

    // No valid input found
    setMoleculeToDisplay(null);
  }, [metaframeInputs]);

  return (
    <Flex direction="column" width="100%" height="100vh" position="relative">
      <Box
        flex="1"
        width="100%"
        id="viewer"
        borderWidth="1px"
        borderRadius="lg"
        backgroundColor={
          options.backgroundColor === "black" ? "black" : "white"
        }
        ref={ref}
      ></Box>
      <MolstarSettingsButton
        options={ViewerOptions}
        currentOptions={options}
        pdbId={pdbIdFromHash || ""}
        onOptionsChange={setOptions}
        onMoleculeIdChange={setMoleculeIdFromHash}
      />
    </Flex>
  );
};
