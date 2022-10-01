import { useRef, useEffect } from "react";
import { useMetaframeAndInput } from "@metapages/metaframe-hook";
import { Box } from "@chakra-ui/react";

declare global {
  interface Window {
    PDBeMolstarPlugin: any;
  }
}

export const MolstarViewer: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const refInstance = useRef<any>(null);
  const metaframeBlob = useMetaframeAndInput();

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    //Set options (** All the available options are listed below in the documentation)
    // https://github.com/molstar/pdbe-molstar/wiki/1.-PDBe-Molstar-as-JS-plugin
    const options = metaframeBlob?.inputs?.["config"] ?? {
      hideControls: true,
    };

    const pdbId: string = metaframeBlob?.inputs?.["pdb-id"] ?? "1tqn";

    options.moleculeId = options.moleculeId ?? pdbId?.toLowerCase();

    //Get element from HTML/Template to place the viewer
    const viewerContainer = ref.current;

    //Call render method to display the 3D view
    if (refInstance.current) {
      refInstance.current.visual.update(options);
    } else {
      refInstance.current = new window.PDBeMolstarPlugin();
      refInstance.current.render(viewerContainer, options);
    }
  }, [ref, refInstance, metaframeBlob?.inputs]);

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
