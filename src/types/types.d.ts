declare module "PDBeMolstarPlugin";
declare module "molstar";
declare module "molstar/build/viewer";


declare global {
    interface Window {
        PDBeMolstarPlugin: Any;
    }
}
