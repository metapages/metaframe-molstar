import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Viewer } from 'molstar/lib/apps/viewer/app.js';
import { useDebouncedCallback } from 'use-debounce';

import { Box } from '@chakra-ui/react';
import { useHashParamJson } from '@metapages/hash-query/react-hooks';
import {
  MetaframeObject,
  useMetaframe,
} from '@metapages/metapage-react';

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
  viewportShowAnimation: false,
  pdbProvider: "rcsb",
  emdbProvider: "rcsb",
};

// Helper function to handle datarefs: if value is {type: 'url', value: '...'}, download it
async function resolveDataref(value: any): Promise<any> {
  if (value && typeof value === 'object' && value.type === 'url' && typeof value.value === 'string') {
    try {
      const response = await fetch(value.value);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${value.value}: ${response.statusText}`);
      }
      // For binary files (xtc, gro), return as Blob; for text files (pdb, cif), return as text
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/octet-stream') || contentType.includes('binary')) {
        return await response.blob();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('Error downloading dataref URL:', error);
      throw error;
    }
  }
  return value;
}

export const MolstarViewer: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const refInstance = useRef<Viewer | null>(null);
  const [xtcFile, setxtcFile] = useState<Blob | undefined>();
  const [groFile, setgroFile] = useState<Blob | undefined>();
  const [pdbData, setPdbData] = useState<{data:string, isTrajectory?:boolean} | undefined>();
  const [cifData, setCifData] = useState<string | Blob | {data: string | Blob} | undefined>();
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


  // show pdbData
  useEffect(() => {
    if (!pdbData || !ref.current) {
      return;
    }
    
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
      const viewer = refInstance.current;
      const pdbBlob = new Blob([pdbData.data], { type: 'text/plain' });
      const pdbUrl = URL.createObjectURL(pdbBlob);

      // TODO handle isTrajectory
      viewer.loadStructureFromUrl(pdbUrl, 'pdb');
    })();
    
  }, [pdbData, options, refInstance, ref]);

  // show cifData
  useEffect(() => {
    if (!cifData || !ref.current) {
      return;
    }
    
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
      const viewer = refInstance.current;
      
      // Extract the actual data from various possible formats
      let actualData: string | Blob;
      if (cifData instanceof Blob) {
        actualData = cifData;
      } else if (typeof cifData === 'string') {
        actualData = cifData;
      } else if (cifData && typeof cifData === 'object' && 'data' in cifData) {
        // Handle object format like {data: string | Blob}
        actualData = cifData.data as string | Blob;
      } else if (cifData && typeof cifData === 'object' && 'type' in cifData && (cifData as any).type === 'url' && 'value' in cifData) {
        // Handle dataref format: {type: 'url', value: 'https://...'}
        // This should have been resolved in the input processing, but handle it here as a fallback
        try {
          const resolved = await resolveDataref(cifData);
          actualData = resolved;
        } catch (error) {
          console.error('Error resolving CIF dataref:', error);
          return;
        }
      } else {
        console.error('Invalid CIF data type:', typeof cifData, cifData);
        return;
      }
      
      // Handle both Blob and string inputs
      let cifUrl: string;
      if (actualData instanceof Blob) {
        // Read Blob as text to ensure proper encoding, then create new Blob with correct MIME type
        const text = await actualData.text();
        const cifBlob = new Blob([text], { type: 'text/plain; charset=utf-8' });
        cifUrl = URL.createObjectURL(cifBlob);
      } else if (typeof actualData === 'string') {
        // Create Blob from string with proper encoding
        const cifBlob = new Blob([actualData], { type: 'text/plain; charset=utf-8' });
        cifUrl = URL.createObjectURL(cifBlob);
      } else {
        console.error('Invalid CIF data format after extraction:', typeof actualData);
        return;
      }

      try {
        // TODO handle isTrajectory
        await viewer.loadStructureFromUrl(cifUrl, 'mmcif');
      } catch (error) {
        console.error('Error loading CIF file:', error);
        // Clean up the object URL on error
        URL.revokeObjectURL(cifUrl);
      }
    })();
    
  }, [cifData, options, refInstance, ref]);

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

  // Debounced callback to process metaframe inputs
  // Only processes the first valid input found (in priority order)
  const processInputs = useDebouncedCallback(async (inputs: any) => {
    if (!inputs) {
      return;
    }
    
    // Clear all state first
    setPdbId(undefined);
    setPdbData(undefined);
    setCifData(undefined);
    setxtcFile(undefined);
    setgroFile(undefined);
    
    const keys = Object.keys(inputs);
    
    // Priority 1: pdb-id (direct ID lookup)
    for (const key of keys) {
      if (key === "pdb-id" || key === "pdbid" || key === "pdbId" || key === "pdbID") {
        const value = inputs[key];
        const resolvedValue = await resolveDataref(value);
        setPdbId(resolvedValue);
        return; // Found valid input, stop processing
      }
    }
    
    // Priority 2: .pdb files
    for (const key of keys) {
      if (key.endsWith(".pdb")) {
        const value = inputs[key];
        const resolvedValue = await resolveDataref(value);
        setPdbData({data:resolvedValue, isTrajectory:key.includes("traj")});
        return; // Found valid input, stop processing
      }
    }
    
    // Priority 3: .cif files
    for (const key of keys) {
      if (key.endsWith(".cif")) {
        const value = inputs[key];
        const resolvedValue = await resolveDataref(value);
        setCifData(resolvedValue);
        return; // Found valid input, stop processing
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
      const resolvedXtc = await resolveDataref(xtcValue);
      const resolvedGro = await resolveDataref(groValue);
      setxtcFile(resolvedXtc);
      setgroFile(resolvedGro);
      return; // Found valid input, stop processing
    }
  }, 200);

  // handle metaframe inputs
  useEffect(() => {
    processInputs(metaframeInputs);
  }, [metaframeInputs, processInputs]);

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
