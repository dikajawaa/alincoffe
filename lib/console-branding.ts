/**
 * Console Branding & Security Warning
 * Provides a professional look and warns users against Self-XSS attacks.
 */
export const initConsoleBranding = () => {
  // Only execute in the browser
  if (typeof window === 'undefined') return;

  console.clear();

  // ASCII Art Logo (Natlin / Alinco)
  console.log(`%c
███╗   ██╗ █████╗ ████████╗██╗     ██╗███╗   ██╗
████╗  ██║██╔══██╗╚══██╔══╝██║     ██║████╗  ██║
██╔██╗ ██║███████║   ██║   ██║     ██║██╔██╗ ██║
██║╚██╗██║██╔══██║   ██║   ██║     ██║██║╚██╗██║
██║ ╚████║██║  ██║   ██║   ███████╗██║██║ ╚████║
╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝╚═╝  ╚═══╝
  `, 'color: #f59e0b; font-weight: bold;');

  console.log(
    "%c👋 Hello Developer!",
    "font-size: 20px; font-weight: bold; color: #10b981;"
  );


  console.log("\n");

  console.log(
    "% www.alinco.my.id",
    "color: #9ca3af; font-size: 11px;"
  );
};
