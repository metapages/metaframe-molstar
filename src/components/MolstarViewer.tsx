import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Viewer } from 'molstar/lib/apps/viewer/app.js';

import { Box } from '@chakra-ui/react';
import { useHashParamJson } from '@metapages/hash-query';
import {
  MetaframeObject,
  useMetaframe,
} from '@metapages/metaframe-hook';

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
  const [xtcFile, setxtcFile] = useState<Blob | undefined>();
  const [groFile, setgroFile] = useState<Blob | undefined>();
  const [pdbId, setPdbId] = useState<string | undefined>();
  const [options, setOptions] = useHashParamJson<any>(
    "options",
    DefaultOptions
  );

  // a nice hook handles all the metaframe machinery
  const metaframeObj: MetaframeObject = useMetaframe();
  const [metaframeInputs, setMetaframeInputs] = useState<any>({});
  useEffect(() => {
    if (!metaframeObj.metaframe) {
      return;
    }
    const disposer = metaframeObj.metaframe.onInputs((inputs) => {
      setMetaframeInputs(inputs);
    });
    setMetaframeInputs(metaframeObj.metaframe.getInputs());

    return () => {
      disposer();
    }

  }, [metaframeObj.metaframe]);


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
    if (metaframeInputs?.["pdb-id"]) {
      setPdbId(metaframeInputs?.["pdb-id"]);
    }

    if (metaframeInputs?.["target.xtc"]) {
      setxtcFile(metaframeInputs?.["target.xtc"]);
    }
    if (metaframeInputs?.["target.gro"]) {
      setgroFile(metaframeInputs?.["target.gro"]);
    }
  }, [setOptions, setPdbId, metaframeInputs, setxtcFile, setgroFile]);

  return (
    <Box
      width="100%"
      height="100vh"
      id="viewer"
      borderWidth="1px"
      borderRadius="lg"
      ref={ref}
    ></Box>
  );
};
