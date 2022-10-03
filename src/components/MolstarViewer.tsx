import { useRef, useEffect, useState } from "react";
import { useMetaframeAndInput } from "@metapages/metaframe-hook";
import { Box } from "@chakra-ui/react";
import { Viewer } from "molstar/lib/apps/viewer/app.js";
import { useHashParamJson } from "@metapages/hash-query";

const DefaultOptions = {
  hideControls: true,

  layoutIsExpanded: false,
  layoutShowControls: false,
  layoutShowRemoteState: false,
  layoutShowSequence: false,
  layoutShowLog: false,
  layoutShowLeftPanel: false,

  viewportShowExpand: false,
  viewportShowSelectionMode: false,
  viewportShowAnimation: true,
  pdbProvider: "rcsb",
  emdbProvider: "rcsb",
};

export const MolstarViewer: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const refInstance = useRef<Viewer | null>(null);
  const metaframeBlob = useMetaframeAndInput();
  const [xtcFile, setxtcFile] = useState<Blob | undefined>();
  const [groFile, setgroFile] = useState<Blob | undefined>();
  const [pdbId, setPdbId] = useState<string | undefined>();
  const [options, setOptions] = useHashParamJson<any>(
    "options",
    DefaultOptions
  );

  // show pdbId
  useEffect(() => {
    if (pdbId) {
      if (refInstance.current) {
        refInstance.current.plugin.dispose();
        refInstance.current = null;
      }
      const viewerContainer = ref.current;
      if (!viewerContainer) {
        return;
      }

      (async () => {
        refInstance.current = await Viewer.create(viewerContainer, {
          ...options,
        });
        refInstance.current.loadPdb(pdbId);
      })();
    }
  }, [pdbId, options, refInstance, ref]);

  // show trajectories
  useEffect(() => {
    if (!xtcFile || !groFile) {
      return;
    }
    const viewerContainer = ref.current;
    if (!viewerContainer) {
      return;
    }

    (async () => {
      (async () => {
        refInstance.current = await Viewer.create(viewerContainer, {
          ...options,
        });
        const xtcObjectUrl = URL.createObjectURL(xtcFile);
        const groObjectUrl = URL.createObjectURL(groFile);

        refInstance.current.loadTrajectory({
          model: { kind: "model-url", url: groObjectUrl, format: "gro" },
          coordinates: {
            kind: "coordinates-url",
            url: xtcObjectUrl,
            format: "xtc",
            isBinary: true,
          },
          // preset: "all-models", // or 'default'
          preset: "default", // or 'default'
        });
      })();
    })();
  }, [xtcFile, groFile, options, refInstance, ref]);

  // create the viewer or update options
  useEffect(() => {
    //Get element from HTML/Template to place the viewer
    const viewerContainer = ref.current;
    if (!viewerContainer) {
      return;
    }

    (async () => {
      if (refInstance.current) {
        refInstance.current.plugin.dispose();
        refInstance.current = null;
      }
      if (!refInstance.current) {
        refInstance.current = await Viewer.create(viewerContainer, {
          ...options,
        });
      }
    })();
  }, [ref, refInstance, options]);

  // handle metaframe inputs
  useEffect(() => {
    if (metaframeBlob?.inputs?.["pdb-id"]) {
      setPdbId(metaframeBlob?.inputs?.["pdb-id"]);
    }

    if (metaframeBlob?.inputs?.["target.xtc"]) {
      setxtcFile(metaframeBlob?.inputs?.["target.xtc"]);
    }
    if (metaframeBlob?.inputs?.["target.gro"]) {
      setgroFile(metaframeBlob?.inputs?.["target.gro"]);
    }
  }, [setOptions, setPdbId, metaframeBlob?.inputs, setxtcFile, setgroFile]);

  return (
    <Box
      width="100%"
      height="50vh"
      id="viewer"
      borderWidth="1px"
      borderRadius="lg"
      ref={ref}
    ></Box>
  );
};
