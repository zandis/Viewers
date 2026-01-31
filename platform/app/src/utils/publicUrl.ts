/**
 * Extended Window interface for OHIF-specific global properties
 */
interface OHIFWindow extends Window {
  PUBLIC_URL?: string;
  config?: {
    routerBasename?: string;
    [key: string]: unknown;
  };
}

const ohifWindow = window as unknown as OHIFWindow;
const publicUrl = ohifWindow.PUBLIC_URL || '/';
const routerBasename = ohifWindow.config?.routerBasename || publicUrl;

export { publicUrl, routerBasename };

export default publicUrl;
