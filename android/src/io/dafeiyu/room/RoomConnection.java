package io.dafeiyu.room;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/** Strict, platform-independent pairing parser; no DSH credentials. */
public final class RoomConnection {
    public final String origin,token;
    public static final String PREFIX="/plugins/dsh-dafeiyu-room";
    private RoomConnection(String origin,String token){this.origin=origin;this.token=token;}
    public static RoomConnection parse(String input){
        try {
            URI uri=new URI(input.trim());
            String scheme=uri.getScheme();
            boolean secure="https".equalsIgnoreCase(scheme),lan="http".equalsIgnoreCase(scheme)&&privateIpv4(uri.getHost());
            if((!secure&&!lan)||uri.getHost()==null||uri.getRawUserInfo()!=null||uri.getRawQuery()!=null||uri.getPort()<-1||uri.getPort()==0||uri.getPort()>65535)throw new IllegalArgumentException();
            if(!((PREFIX+"/mobile.html").equals(uri.getPath())||(PREFIX+"/android.html").equals(uri.getPath())))throw new IllegalArgumentException();
            String key=null,fragment=uri.getRawFragment();
            if(fragment!=null)for(String part:fragment.split("&")){int at=part.indexOf('=');if(at>=0&&part.substring(0,at).equals("key"))key=URLDecoder.decode(part.substring(at+1),"UTF-8");}
            if(key==null||!key.matches("[A-Za-z0-9_-]{43}"))throw new IllegalArgumentException();
            return new RoomConnection((secure?"https":"http")+"://"+uri.getRawAuthority(),key);
        }catch(Exception error){throw new IllegalArgumentException("请使用电脑生成的完整小屋连接：内网IPv4地址，或HTTPS地址（含访问凭证）。");}
    }
    private static boolean privateIpv4(String host){
        if(host==null||!host.matches("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+"))return false;
        String[] parts=host.split("\\.");int[] ip=new int[4];
        try{for(int i=0;i<4;i++){if(parts[i].length()>1&&parts[i].startsWith("0"))return false;ip[i]=Integer.parseInt(parts[i]);if(ip[i]>255)return false;}}catch(Exception e){return false;}
        return ip[0]==10||ip[0]==192&&ip[1]==168||ip[0]==172&&ip[1]>=16&&ip[1]<=31;
    }
    public String stateUrl(){return origin+PREFIX+"/state";}
    public String pairingUrl(){return origin+PREFIX+"/android.html#key="+token;}
}
