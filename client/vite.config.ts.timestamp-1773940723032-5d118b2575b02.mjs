// vite.config.ts
import { defineConfig } from "file:///sessions/serene-kind-mendel/mnt/negoatiations/client/node_modules/vite/dist/node/index.js";
import path from "path";
var __vite_injected_original_dirname = "/sessions/serene-kind-mendel/mnt/negoatiations/client";
var vite_config_default = defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "http://localhost:2567",
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      shared: path.resolve(__vite_injected_original_dirname, "../shared/src")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvc2VyZW5lLWtpbmQtbWVuZGVsL21udC9uZWdvYXRpYXRpb25zL2NsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3NlcmVuZS1raW5kLW1lbmRlbC9tbnQvbmVnb2F0aWF0aW9ucy9jbGllbnQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3NlcmVuZS1raW5kLW1lbmRlbC9tbnQvbmVnb2F0aWF0aW9ucy9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIHByb3h5OiB7XG4gICAgICAnL3dzJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjI1NjcnLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBzaGFyZWQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9zaGFyZWQvc3JjJyksXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpVixTQUFTLG9CQUFvQjtBQUM5VyxPQUFPLFVBQVU7QUFEakIsSUFBTSxtQ0FBbUM7QUFHekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsSUFBSTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsUUFBUSxLQUFLLFFBQVEsa0NBQVcsZUFBZTtBQUFBLElBQ2pEO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
