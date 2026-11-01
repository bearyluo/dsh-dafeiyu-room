package io.dafeiyu.room;

import android.content.Context;
import android.webkit.*;
import java.io.*;
import java.net.URL;
import java.net.HttpURLConnection;
import java.util.*;
import org.json.JSONObject;

/** APK assets stay available even when the paired computer is completely off. */
public final class CabinWebClient extends WebViewClient {
    public static final String LOCAL="https://room.dafeiyu.invalid/";
    public interface Listener {void onState(boolean reachable,boolean connected);}
    private final Context context;private final RoomConnection paired;private final Listener listener;
    public CabinWebClient(Context context,RoomConnection paired,Listener listener){this.context=context.getApplicationContext();this.paired=paired;this.listener=listener;}
    public static void configure(WebView view){
        WebSettings s=view.getSettings();s.setJavaScriptEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setDomStorageEnabled(false);s.setCacheMode(WebSettings.LOAD_NO_CACHE);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view,false);view.setBackgroundColor(0xff284b3c);
    }
    private WebResourceResponse response(String mime,int status,byte[] bytes){
        WebResourceResponse r=new WebResourceResponse(mime,"UTF-8",new ByteArrayInputStream(bytes));r.setStatusCodeAndReasonPhrase(status,status==200?"OK":"Unavailable");
        Map<String,String> h=new HashMap<>();h.put("Cache-Control","no-store");h.put("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'");r.setResponseHeaders(h);return r;
    }
    private void notifyState(boolean reachable,boolean connected){if(listener!=null)listener.onState(reachable,connected);}
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
        String url=request.getUrl().toString();if(!url.startsWith(LOCAL)||!"GET".equals(request.getMethod()))return response("text/plain",403,new byte[0]);
        String path=request.getUrl().getPath();
        if("/state".equals(path)){
            HttpURLConnection conn=null;
            try{
                if(paired==null)throw new IOException("not paired");
                conn=(HttpURLConnection)new URL(paired.stateUrl()).openConnection();conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(4000);conn.setReadTimeout(4000);conn.setRequestProperty("Authorization","Bearer "+paired.token);conn.setRequestProperty("Accept","application/json");
                int status=conn.getResponseCode();if(status!=200){notifyState(false,false);return response("application/json",status,new byte[0]);}
                try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>524288)throw new IOException("state too large");}
                    byte[] bytes=out.toByteArray();JSONObject state=new JSONObject(new String(bytes,"UTF-8"));
                    if(state.optInt("schema")!=1||!state.has("body"))throw new IOException("invalid state");
                    notifyState(true,state.optBoolean("connected"));return response("application/json",200,bytes);
                }
            }catch(Exception error){notifyState(false,false);return response("application/json",503,new byte[0]);}finally{if(conn!=null)conn.disconnect();}
        }
        String mime=CameraAssets.mime(path);if(mime==null)return response("text/plain",404,new byte[0]);
        try(InputStream in=context.getAssets().open("web"+path);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] bytes=new byte[16384];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);return response(mime,200,out.toByteArray());
        }catch(Exception error){return response("text/plain",404,new byte[0]);}
    }
}
