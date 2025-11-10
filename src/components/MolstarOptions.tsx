import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import equal from 'fast-deep-equal/es6';

import {
  deleteHashParamFromWindow,
  useHashParamJson,
} from '@metapages/hash-query/react-hooks';

import { Option } from './ButtonOptionsMenu';

// Define options from
// https://github.com/molstar/molstar/blob/master/src/apps/viewer/app.ts
export const ViewerOptions: Option[] = [
  // Data loading options (at top)
  {
    name: "pdbId",
    displayName: "PDB ID",
    default: "",
    type: "string",
  },
  // Visual options
  {
    name: "backgroundColor",
    displayName: "Background color",
    default: "white",
    type: "option",
    options: ["white", "black"],
  },
  // INTERFACE options
  {
    name: "layoutShowControls",
    displayName: "Layout Show controls",
    default: false,
    type: "boolean",
  },

  {
    name: "viewportShowScreenshotControls",
    displayName: "Show screenshot controls",
    default: false,
    type: "boolean",
  },

  {
    name: "viewportShowSettings",
    displayName: "Show settings controls",
    default: false,
    type: "boolean",
  },

  // Layout options
  {
    name: "layoutIsExpanded",
    displayName: "Layout is expanded",
    default: false,
    type: "boolean",
  },
  {
    name: "layoutShowRemoteState",
    displayName: "Show remote state",
    default: false,
    type: "boolean",
  },
  {
    name: "layoutControlsDisplay",
    displayName: "Controls display",
    default: "reactive",
    type: "option",
    options: ["reactive", "static"],
  },
  {
    name: "layoutShowSequence",
    displayName: "Show sequence",
    default: false,
    type: "boolean",
  },
  {
    name: "layoutShowLog",
    displayName: "Show log",
    default: false,
    type: "boolean",
  },
  {
    name: "layoutShowLeftPanel",
    displayName: "Show left panel",
    default: false,
    type: "boolean",
  },
  {
    name: "collapseLeftPanel",
    displayName: "Collapse left panel",
    default: false,
    type: "boolean",
  },
  {
    name: "collapseRightPanel",
    displayName: "Collapse right panel",
    default: false,
    type: "boolean",
  },

  // General/Performance options
  {
    name: "disableAntialiasing",
    displayName: "Disable antialiasing",
    default: false,
    type: "boolean",
  },
  {
    name: "pixelScale",
    displayName: "Pixel scale",
    default: 1,
    type: "number",
  },
  {
    name: "pickScale",
    displayName: "Pick scale",
    default: 1,
    type: "number",
  },
  {
    name: "transparency",
    displayName: "Transparency",
    default: false,
    type: "boolean",
  },
  {
    name: "preferWebgl1",
    displayName: "Prefer WebGL 1",
    default: false,
    type: "boolean",
  },
  {
    name: "allowMajorPerformanceCaveat",
    displayName: "Allow major performance caveat",
    default: false,
    type: "boolean",
  },
  {
    name: "powerPreference",
    displayName: "Power preference",
    default: "default",
    type: "option",
    options: ["default", "high-performance", "low-power"],
  },
  {
    name: "resolutionMode",
    displayName: "Resolution mode",
    default: "auto",
    type: "option",
    options: ["auto", "auto-dpi", "manual"],
  },
  {
    name: "illumination",
    displayName: "Illumination",
    default: false,
    type: "boolean",
  },

  // Viewport options
  {
    name: "viewportShowReset",
    displayName: "Show reset",
    default: false,
    type: "boolean",
  },
  {
    name: "viewportShowControls",
    displayName: "Viewport Show controls",
    default: false,
    type: "boolean",
  },
  {
    name: "viewportShowExpand",
    displayName: "Show expand",
    default: false,
    type: "boolean",
  },
  {
    name: "viewportShowToggleFullscreen",
    displayName: "Show toggle fullscreen",
    default: false,
    type: "boolean",
  },
  {
    name: "viewportShowSelectionMode",
    displayName: "Show selection mode",
    default: false,
    type: "boolean",
  },
  {
    name: "viewportShowAnimation",
    displayName: "Show animation",
    default: false,
    type: "boolean",
  },
  {
    name: "viewportShowVR",
    displayName: "Show VR",
    default: false,
    type: "boolean",
  },
];

const EmptyOptions: Record<string, any> = {};


// Build default options from viewerOptions definitions
// This ensures defaults are centralized and match the option definitions
const buildDefaultOptions = (): Record<string, any> => {
  const defaults: Record<string, any> = {};
  ViewerOptions.forEach((option) => {
    if (option.default !== undefined) {
      defaults[option.name] = option.default;
    }
  });
  // Add bgColor as a special case (not in viewerOptions but needed for viewer)
  // defaults.bgColor = { r: 255, g: 255, b: 255 };
  return defaults;
};

const DefaultOptions = buildDefaultOptions();

/**
   * Filters out default values from options object
   * - Removes boolean false values if false is the default
   * - Removes any option that matches its default value
   * - Returns undefined if all options are defaults
   */
const filterDefaultOptions = (options: Record<string, any>): Record<string, any> | undefined => {
  if (!options || Object.keys(options).length === 0) {
    return undefined;
  }
  
  const filtered: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(options)) {
    const optionDef = ViewerOptions.find((opt) => opt.name === key);
    
    if (!optionDef) {
      // Handle special cases like bgColor
      if (key === 'bgColor') {
        const defaultBgColor = { r: 255, g: 255, b: 255 };
        // Deep compare for objects
        if (
          typeof value === 'object' &&
          value !== null &&
          value.r === defaultBgColor.r &&
          value.g === defaultBgColor.g &&
          value.b === defaultBgColor.b
        ) {
          // Matches default, skip it
          continue;
        }
      }
      // If no definition found and not a special case, keep the value
      filtered[key] = value;
      continue;
    }
    
    const defaultValue = optionDef.default;
    
    // Skip if value matches default (this includes boolean false when default is false)
    if (value === defaultValue) {
      continue;
    }
    
    // Keep non-default values
    filtered[key] = value;
  }
  
  // Return undefined if all options were filtered out (all defaults)
  return Object.keys(filtered).length === 0 ? undefined : filtered;
};

export const useMolstarOptions = () : [Record<string, any>, (options: Record<string, any>) => void] => {
  // Initialize with undefined so we don't write defaults to hash on first load
  const [optionsFromHash, setOptionsToHash] = useHashParamJson<any>(
    "config",
    undefined
  );
  const [options, setOptions] = useState<Record<string, any>>(DefaultOptions);
  const optionsRef = useRef<Record<string, any>>();
  

  // Filter defaults from hash on initial load to clean up any defaults that were written
  useEffect(() => {
    if (optionsFromHash) {
      const filtered = filterDefaultOptions(optionsFromHash) || EmptyOptions;
      if (equal(filtered, optionsRef.current)) {
        return;
      }
      optionsRef.current = filtered;
      setOptions(filtered);
      // // Only update if filtering removed something (i.e., hash contains defaults)
      // // Compare JSON strings to check if anything changed (handle undefined case)
      // const originalStr = JSON.stringify(optionsFromHash);
      // const filteredStr = filtered === undefined ? undefined : JSON.stringify(filtered);
      // if (filteredStr !== originalStr) {
      //   setOptionsFromHash(filtered);
      // }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsFromHash]); // Only run on mount to clean up initial hash

  const setOptionsAfterChecking = useCallback((newoptions: Record<string, any>) => {
    if (equal(newoptions, optionsRef.current || EmptyOptions)) {
      return;
    }
    const filtered = filterDefaultOptions(newoptions);
    if (filtered) {
      setOptionsToHash(filtered);
    } else {
      deleteHashParamFromWindow("config");
    }
    optionsRef.current = filtered;
    setOptions(filtered || EmptyOptions);
  }, [setOptionsToHash]);

  // Merge hash params with defaults to ensure all options are present
  // const options = { ...DefaultOptions, ...(optionsFromHash || EmptyOptions) };
  return [options, setOptionsAfterChecking];
};