import React, { useCallback, useEffect, useState } from "react";

import { CheckIcon, QuestionIcon, SettingsIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  Link,
  Select,
  Spacer,
  Switch,
  Text,
} from "@chakra-ui/react";

import { Option } from "./ButtonOptionsMenu";

/**
 * Filters out default values from options object
 * - Removes boolean false values if false is the default
 * - Removes any option that matches its default value
 * - Returns undefined if all options are defaults
 */
const filterDefaultOptions = (
  options: Record<string, any>,
  optionDefinitions: Option[]
): Record<string, any> | undefined => {
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(options)) {
    const optionDef = optionDefinitions.find((opt) => opt.name === key);

    if (!optionDef) {
      // If no definition found, keep the value
      filtered[key] = value;
      continue;
    }

    const defaultValue = optionDef.default;

    // Skip if value matches default
    // Special handling: boolean false with default false should be removed
    if (value === defaultValue) {
      continue;
    }

    // Keep non-default values
    filtered[key] = value;
  }

  // Return undefined if all options were filtered out (all defaults)
  return Object.keys(filtered).length === 0 ? undefined : filtered;
};

interface MolstarSettingsButtonProps {
  options: Option[];
  currentOptions?: Record<string, any>; // Current options from hash params
  pdbId?: string; // Current pdbId from separate hash param
  onOptionsChange: (options: any) => void;
  onMoleculeIdChange: (pdbId: string | undefined) => void;
}

export const MolstarSettingsButton: React.FC<MolstarSettingsButtonProps> = ({
  options,
  currentOptions = {},
  pdbId = "",
  onOptionsChange,
  onMoleculeIdChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [localOptions, setLocalOptions] = useState<Record<string, any>>({});

  // Get current options when drawer opens - prioritize currentOptions (from hash params) over viewer.initParams
  useEffect(() => {
    if (isOpen) {
      try {
        let currentOptionsToUse: any = {};

        // First, try to get from currentOptions prop (hash params)
        if (currentOptions && Object.keys(currentOptions).length > 0) {
          currentOptionsToUse = { ...currentOptions };
        }

        // Add pdbId from separate hash param
        if (pdbId !== undefined && pdbId !== null) {
          currentOptionsToUse.pdbId = pdbId;
        }

        // Merge with defaults from option definitions to ensure all fields are present
        const defaults: Record<string, any> = {};
        options.forEach((option) => {
          if (option.default !== undefined) {
            defaults[option.name] = option.default;
          }
        });

        setLocalOptions({ ...defaults, ...currentOptionsToUse });
      } catch (error) {
        console.warn("Could not get current options:", error);
        // Fallback to defaults
        const defaults: Record<string, any> = {};
        options.forEach((option) => {
          if (option.default !== undefined) {
            defaults[option.name] = option.default;
          }
        });
        setLocalOptions(defaults);
      }
    }
  }, [isOpen, currentOptions, pdbId, options]);

  const handleOnChange = useCallback(
    (event: any) => {
      const { name, value } = event.target as HTMLInputElement;
      const option = options.find((o) => o.name === name);

      if (!option) {
        console.error(`No option found for name=${name}`);
        return;
      }

      if (option.type === "boolean") {
        setLocalOptions({ ...localOptions, [name]: value === "1" });
      } else {
        setLocalOptions({ ...localOptions, [name]: value });
      }
    },
    [localOptions, options]
  );

  const handleApply = useCallback(() => {
    // Extract pdbId and handle separately
    const { pdbId: localMoleculeId, ...otherOptions } = localOptions;

    // Update pdbId in separate hash param
    if (localMoleculeId !== undefined) {
      const trimmedId =
        typeof localMoleculeId === "string"
          ? localMoleculeId.trim()
          : localMoleculeId;
      onMoleculeIdChange(trimmedId === "" ? undefined : trimmedId);
    }

    // Filter out default values from options
    const filteredOptions = filterDefaultOptions(otherOptions, options);

    // Update other options (excluding pdbId and defaults)
    onOptionsChange(filteredOptions);

    setIsOpen(false);
  }, [localOptions, onOptionsChange, onMoleculeIdChange, options]);

  const renderInput = (option: Option, value: any) => {
    switch (option.type) {
      case "option":
        return (
          <Select
            name={option.name}
            value={value !== undefined ? value : option.default}
            onChange={handleOnChange}
            placeholder="Select option"
          >
            {option.options!.map((optionChoice) => (
              <option key={optionChoice} value={optionChoice}>
                {optionChoice}
              </option>
            ))}
          </Select>
        );
      case "boolean":
        return (
          <Switch
            name={option.name}
            onChange={handleOnChange}
            isChecked={
              value === true ||
              value === "1" ||
              (value === undefined && option.default === true)
            }
            value={
              value === true || (value === undefined && option.default === true)
                ? 0
                : 1
            }
          />
        );
      default:
        return (
          <Input
            name={option.name}
            type="text"
            placeholder=""
            value={value === undefined ? option.default || "" : value}
            onInput={handleOnChange}
          />
        );
    }
  };

  // Always render the button - it will be functional once viewer is available
  // Don't wait for viewer to exist before showing the button
  return (
    <>
      <Box
        position="fixed"
        bottom="16px"
        right="16px"
        zIndex={9999}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        opacity={isHovered || isOpen ? 1 : 0}
        transition="opacity 0.2s"
        pointerEvents="auto"
        _hover={{ opacity: 1 }}
        style={{
          position: "fixed",
          zIndex: 9999,
        }}
      >
        <IconButton
          aria-label="Molstar settings"
          icon={<SettingsIcon />}
          size="md"
          onClick={() => {
            if (isOpen) {
              // If drawer is open, save options and close
              handleApply();
            } else {
              // If drawer is closed, open it
              setIsOpen(true);
            }
          }}
        />
      </Box>
      {isOpen && (
        <Drawer
          placement="bottom"
          onClose={() => {
            setIsOpen(false);
            // Reset hover state when drawer closes to ensure button is visible
            setIsHovered(false);
          }}
          isOpen={isOpen}
          blockScrollOnMount={false}
        >
          <DrawerOverlay>
            <DrawerContent>
              <DrawerHeader borderBottomWidth="0px">
                <HStack spacing={2}>
                  <Text>Molstar Viewer Settings</Text>
                  <Link
                    href="https://github.com/metapages/metaframe-molstar"
                    isExternal
                    aria-label="Molstar Metaframe documentation"
                  >
                    <IconButton
                      aria-label="Help - Molstar Metaframe documentation"
                      icon={<QuestionIcon />}
                      size="sm"
                      variant="ghost"
                    />
                  </Link>
                </HStack>
              </DrawerHeader>
              <DrawerBody>
                <Box
                  maxW="80%"
                  p={2}
                  borderWidth="4px"
                  borderRadius="lg"
                  overflow="hidden"
                >
                  <Grid templateColumns="repeat(12, 1fr)" gap={6}>
                    {options.map((option) => (
                      <React.Fragment key={option.name}>
                        <GridItem rowSpan={1} colSpan={4}>
                          <Box
                            w="100%"
                            h="100%"
                            display="flex"
                            alignItems="center"
                            justifyContent="flex-end"
                          >
                            <Text textAlign={"right"} verticalAlign="bottom">
                              {option.displayName || option.name}:
                            </Text>
                          </Box>
                        </GridItem>
                        <GridItem rowSpan={1} colSpan={8}>
                          {renderInput(option, localOptions[option.name])}
                        </GridItem>
                      </React.Fragment>
                    ))}
                    <GridItem rowSpan={1} colSpan={12}>
                      <HStack spacing={2} direction="row">
                        <Spacer />
                        <Button
                          size="lg"
                          colorScheme="green"
                          aria-label="Apply"
                          leftIcon={<CheckIcon />}
                          onClick={handleApply}
                        >
                          OK
                        </Button>
                      </HStack>
                    </GridItem>
                  </Grid>
                </Box>
              </DrawerBody>
            </DrawerContent>
          </DrawerOverlay>
        </Drawer>
      )}
    </>
  );
};
