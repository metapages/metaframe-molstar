import {
  useEffect,
  useRef,
  useState,
} from 'react';

import equal from 'fast-deep-equal';
import { useDebouncedCallback } from 'use-debounce';

import { MetaframeInputMap } from '@metapages/metapage';
import {
  MetaframeObject,
  useMetaframe,
} from '@metapages/metapage-react';

// Helper function to handle datarefs: if value is {type: 'url', value: '...'}, download it
async function resolveDataref(value: any): Promise<any> {
  if (
    value &&
    typeof value === "object" &&
    value.type === "url" &&
    typeof value.value === "string"
  ) {
    try {
      const response = await fetch(value.value);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${value.value}: ${response.statusText}`
        );
      }
      // For binary files (xtc, gro), return as Blob; for text files (pdb, cif), return as text
      const contentType = response.headers.get("content-type") || "";
      if (
        contentType.includes("application/octet-stream") ||
        contentType.includes("binary")
      ) {
        return await response.blob();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error("Error downloading dataref URL:", error);
      throw error;
    }
  }
  return value;
}

export const useDebouncedMetaframeInputs = () :MetaframeInputMap|null => {

  // a nice hook handles all the metaframe machinery
  const metaframeObj: MetaframeObject = useMetaframe();
  const [metaframeInputs, setMetaframeInputs] = useState<MetaframeInputMap|null>(null);
  // Ref to track the current input being processed (by reference equality)
  const metaframeInputRef = useRef<MetaframeInputMap|null>(null);

  const onMetaframeInputsDebounced = useDebouncedCallback(async (inputs: MetaframeInputMap) => {
    if (!inputs || Object.keys(inputs).length === 0) {
      return;
    }
    if (equal(inputs, metaframeInputRef.current)) {
      return;
    }

    metaframeInputRef.current = inputs;

    const dereferencedInputsArray = await Promise.all(Object.entries(inputs).map(async ([key, value]) => {
      const resolvedValue = await resolveDataref(value);
      return [key, resolvedValue];
      
    }));

    setMetaframeInputs(Object.fromEntries(dereferencedInputsArray));
  }, 200);

  useEffect(() => {
    if (!metaframeObj.metaframe) {
      return;
    }
    const disposer = metaframeObj.metaframe.onInputs(onMetaframeInputsDebounced);
    onMetaframeInputsDebounced(metaframeObj.metaframe.getInputs());

    return () => {
      disposer();
    };
  }, [metaframeObj.metaframe, onMetaframeInputsDebounced]);
  
  return metaframeInputs;
}

