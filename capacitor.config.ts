import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.qc.manager",
  appName: "QC Manager",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
  },
};

export default config;
