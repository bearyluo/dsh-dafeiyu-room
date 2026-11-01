package io.dafeiyu.room;
public final class CameraAssetsTest {
    public static void main(String[] args){
        for(String path:new String[]{"/index.html","/camera.js","/camera.css","/view-state.cjs","/environment.cjs","/assets/outdoor-garden-v1.png","/assets/cabin-v2.png","/assets/lo-poses.png","/home.js"})if(CameraAssets.mime(path)==null)throw new AssertionError("Missing camera asset: "+path);
        for(String path:new String[]{"/state","/settings","/../src/index.js","/assets/../secret.png","/assets/foo.png/extra","//index.html","/assets/secret.txt","/mobile.js","/index.html?key=private"})if(CameraAssets.mime(path)!=null)throw new AssertionError("Unexpected asset: "+path);
        System.out.println("Native camera allowlist: 9 required resources accepted, 9 unrelated or unsafe paths rejected.");
    }
}
