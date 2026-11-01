package io.dafeiyu.room;

/** Shared allowlist for both the app preview and floating camera. */
public final class CameraAssets {
    private CameraAssets(){}
    public static String mime(String path){
        if(path==null)return null;
        if(path.matches("/(index\\.html|camera\\.(js|css)|home\\.js|(?:environment|motion|simulation|sprite|view-state)\\.cjs|assets/[a-z0-9-]+\\.png)")){
            return path.endsWith(".png")?"image/png":path.endsWith(".html")?"text/html":path.endsWith(".css")?"text/css":"text/javascript";
        }
        return null;
    }
}
