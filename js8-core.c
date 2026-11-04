/* JS8Web LAB raw frame modem subset (GPL-3.0). Original JS8Call contributors.
 * Port of the parity, CRC, Costas, and LDPC raw-frame routines from
 * https://github.com/js8call/js8call/blob/main/JS8.cpp
 * NOT a full JS8Call protocol implementation. */
static const char *G[87]={
"23bba830e23b6b6f50982e",
"1f8e55da218c5df3309052",
"ca7b3217cd92bd59a5ae20",
"56f78313537d0f4382964e",
"6be396b5e2e819e373340c",
"293548a138858328af4210",
"cb6c6afcdc28bb3f7c6e86",
"3f2a86f5c5bd225c961150",
"849dd2d63673481860f62c",
"56cdaec6e7ae14b43feeee",
"04ef5cfa3766ba778f45a4",
"c525ae4bd4f627320a3974",
"41fd9520b2e4abeb2f989c",
"7fb36c24085a34d8c1dbc4",
"40fc3e44bb7d2bb2756e44",
"d38ab0a1d2e52a8ec3bc76",
"3d0f929ef3949bd84d4734",
"45d3814f504064f80549ae",
"f14dbf263825d0bd04b05e",
"db714f8f64e8ac7af1a76e",
"8d0274de71e7c1a8055eb0",
"51f81573dd4049b082de14",
"d8f937f31822e57c562370",
"b6537f417e61d1a7085336",
"ecbd7c73b9cd34c3720c8a",
"3d188ea477f6fa41317a4e",
"1ac4672b549cd6dba79bcc",
"a377253773ea678367c3f6",
"0dbd816fba1543f721dc72",
"ca4186dd44c3121565cf5c",
"29c29dba9c545e267762fe",
"1616d78018d0b4745ca0f2",
"fe37802941d66dde02b99c",
"a9fa8e50bcb032c85e3304",
"83f640f1a48a8ebc0443ea",
"3776af54ccfbae916afde6",
"a8fc906976c35669e79ce0",
"f08a91fb2e1f78290619a8",
"cc9da55fe046d0cb3a770c",
"d36d662a69ae24b74dcbd8",
"40907b01280f03c0323946",
"d037db825175d851f3af00",
"1bf1490607c54032660ede",
"0af7723161ec223080be86",
"eca9afa0f6b01d92305edc",
"7a8dec79a51e8ac5388022",
"9059dfa2bb20ef7ef73ad4",
"6abb212d9739dfc02580f2",
"f6ad4824b87c80ebfce466",
"d747bfc5fd65ef70fbd9bc",
"612f63acc025b6ab476f7c",
"05209a0abb530b9e7e34b0",
"45b7ab6242b77474d9f11a",
"6c280d2a0523d9c4bc5946",
"f1627701a2d692fd9449e6",
"8d9071b7e7a6a2eed6965e",
"bf4f56e073271f6ab4bf80",
"c0fc3ec4fb7d2bb2756644",
"57da6d13cb96a7689b2790",
"a9fa2eefa6f8796a355772",
"164cc861bdd803c547f2ac",
"cc6de59755420925f90ed2",
"a0c0033a52ab6299802fd2",
"b274db8abd3c6f396ea356",
"97d4169cb33e7435718d90",
"81cfc6f18c35b1e1f17114",
"481a2a0df8a23583f82d6c",
"081c29a10d468ccdbcecb6",
"2c4142bf42b01e71076acc",
"a6573f3dc8b16c9d19f746",
"c87af9a5d5206abca532a8",
"012dee2198eba82b19a1da",
"b1ca4ea2e3d173bad4379c",
"b33ec97be83ce413f9acc8",
"5b0f7742bca86b8012609a",
"37d8e0af9258b9e8c5f9b2",
"35ad3fb0faeb5f1b0c30dc",
"6114e08483043fd3f38a8a",
"cd921fdf59e882683763f6",
"95e45ecd0135aca9d6e6ae",
"2e547dd7a05f6597aac516",
"14cd0f642fc0c5fe3a65ca",
"3a0a1dfd7eee29c2e827e0",
"c8b5dffc335095dcdcaf2a",
"3dd01a59d86310743ec752",
"8abdb889efbe39a510a118",
"3f231f212055371cf3e2a2"
};
static const unsigned char check_nodes[87][7]={
{0,29,59,88,117,146,255},
{1,30,60,89,118,146,255},
{2,31,61,90,119,147,255},
{3,32,62,91,120,148,255},
{1,33,63,92,121,149,255},
{4,32,64,93,122,147,255},
{5,33,65,94,123,150,255},
{6,34,66,95,119,151,255},
{7,35,67,96,124,152,255},
{8,36,68,97,125,151,255},
{9,37,69,98,126,153,255},
{10,38,70,99,125,154,255},
{11,39,60,100,127,144,255},
{9,32,59,94,127,155,255},
{12,40,71,96,125,156,255},
{12,41,72,89,128,155,255},
{13,38,73,98,129,157,255},
{14,42,74,101,130,158,255},
{15,42,70,102,117,159,255},
{16,43,75,97,129,155,255},
{17,44,59,95,131,160,255},
{18,45,72,82,132,161,255},
{11,37,76,101,133,162,255},
{18,46,77,103,134,146,255},
{0,31,76,104,135,163,255},
{19,47,72,105,122,162,255},
{20,40,78,106,136,164,255},
{21,41,65,107,137,151,255},
{17,41,79,108,138,153,255},
{22,48,80,109,134,165,255},
{15,49,81,90,128,157,255},
{2,47,62,106,123,166,255},
{5,50,66,110,133,154,255},
{23,34,76,99,121,161,255},
{19,44,75,111,139,156,255},
{20,35,63,91,129,158,255},
{7,51,82,110,117,165,255},
{20,52,83,112,137,167,255},
{24,50,78,88,121,157,255},
{21,43,74,106,132,154,171},
{8,53,83,89,140,168,255},
{21,53,84,109,135,160,255},
{7,36,64,101,128,169,255},
{18,38,84,113,138,149,255},
{25,54,70,92,141,166,255},
{26,55,64,95,132,159,173},
{27,30,85,99,116,170,255},
{27,51,69,103,131,143,255},
{23,56,67,94,136,141,255},
{6,29,71,109,142,150,255},
{3,50,75,114,126,167,255},
{15,44,86,113,124,171,255},
{14,29,85,114,122,149,255},
{22,45,63,90,143,172,255},
{22,34,74,112,144,152,255},
{13,40,86,107,116,148,169},
{24,39,84,93,123,158,255},
{24,57,68,115,142,173,255},
{28,42,60,115,131,161,255},
{14,57,87,111,120,163,255},
{3,58,71,113,118,162,172},
{26,46,85,97,133,152,255},
{4,43,77,108,140,255,255},
{9,45,68,102,135,164,255},
{8,49,58,92,127,163,255},
{13,56,57,108,119,165,255},
{16,54,61,115,124,153,255},
{2,53,69,100,139,169,255},
{0,35,81,107,126,173,255},
{4,52,80,104,139,255,255},
{28,52,66,98,141,172,255},
{17,48,73,96,114,166,255},
{1,56,62,102,137,156,255},
{25,37,78,111,134,170,255},
{10,51,65,87,118,147,255},
{19,39,67,116,140,159,255},
{10,47,80,88,145,168,255},
{28,46,79,91,145,171,255},
{5,31,86,103,144,168,255},
{26,33,73,105,130,164,255},
{11,55,83,87,138,255,255},
{12,55,61,110,145,170,255},
{25,36,79,104,143,150,255},
{16,30,81,112,120,160,255},
{27,48,58,93,136,255,255},
{6,54,82,100,130,167,255},
{23,49,77,105,142,148,255}
};
static const char ALPHABET[]="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-+";
static const unsigned char COSTAS[2][3][7]={
{{4,2,5,6,1,3,0},{4,2,5,6,1,3,0},{4,2,5,6,1,3,0}},
{{0,6,2,3,5,4,1},{1,5,0,2,3,6,4},{2,5,0,6,4,1,3}}
};
static unsigned char input[16],decoded[16],cw[174];
static int tones[79],received_type=-1;
static float llr[174],v2c[87][7],c2v[87][7],sums[174];
__attribute__((visibility("default"))) unsigned js8_input_ptr(void){return (unsigned)(void*)input;}
__attribute__((visibility("default"))) unsigned js8_decoded_ptr(void){return (unsigned)(void*)decoded;}
__attribute__((visibility("default"))) unsigned js8_tones_ptr(void){return (unsigned)(void*)tones;}
__attribute__((visibility("default"))) unsigned js8_llr_ptr(void){return (unsigned)(void*)llr;}
__attribute__((visibility("default"))) int js8_type(void){return received_type;}
static unsigned char bit(const unsigned char *p,int i){return (p[i>>3]>>(7-(i&7)))&1;}
static int hexval(char c){return c<='9'?c-'0':c-'a'+10;}
static int matrix(int row,int col){int n=hexval(G[row][col>>2]);return (n>>(3-(col&3)))&1;}
static unsigned crc12(const unsigned char *bytes){
 unsigned r=0;
 for(int j=0;j<11;j++)for(int i=7;i>=0;i--){
  unsigned v=(bytes[j]>>i)&1,hi=(r>>11)&1;
  r=((r<<1)|v)&4095;
  if(hi)r^=0xc06;
 }
 return r^42;
}
static int crc_ok(const unsigned char *bytes){
 unsigned crc=((bytes[9]&31)<<7)|(bytes[10]>>1);
 unsigned char data[11];for(int i=0;i<11;i++)data[i]=bytes[i];
 data[9]&=224;data[10]=0;
 return crc==crc12(data);
}
__attribute__((visibility("default"))) int js8_encode(int frame_type,int mode){
 if(mode<0||mode>1||frame_type<0||frame_type>7)return -1;
 unsigned char bytes[11]={0};
 for(int i=0;i<12;i++){
  int w=-1;
  for(int k=0;k<64;k++)if(input[i]==(unsigned char)ALPHABET[k]){w=k;break;}
  if(w<0)return -2;
  for(int b=0;b<6;b++)if((w>>(5-b))&1)bytes[(i*6+b)>>3]|=1<<(7-((i*6+b)&7));
 }
 bytes[9]=(frame_type&7)<<5;
 unsigned crc=crc12(bytes);bytes[9]|=(crc>>7)&31;bytes[10]=(crc&127)<<1;
 for(int i=0;i<79;i++)tones[i]=0;
 for(int a=0;a<3;a++)for(int b=0;b<7;b++)tones[a*36+b]=COSTAS[mode][a][b];
 for(int i=0;i<29;i++){
  int pd=0,wd=0;
  for(int k=0;k<3;k++){
   int idx=3*i+k,q=0;
   for(int j=0;j<87;j++)q^=matrix(idx,j)&bit(bytes,j);
   pd=(pd<<1)|q;wd=(wd<<1)|bit(bytes,idx);
  }
  tones[7+i]=pd;tones[43+i]=wd;
 }
 return 0;
}
static int count_syndrome(void){
 int bad=0;for(int c=0;c<87;c++){int s=0;
  for(int j=0;j<7;j++)if(check_nodes[c][j]!=255)s^=cw[check_nodes[c][j]];
  if(s)bad++;
 }return bad;
}
static int unpack_result(void){
 unsigned char data[11]={0};
 for(int i=0;i<87;i++)if(cw[87+i])data[i>>3]|=1<<(7-(i&7));
 if(!crc_ok(data))return -2;
 for(int i=0;i<12;i++){int w=0;for(int j=0;j<6;j++)w=(w<<1)|bit(data,i*6+j);decoded[i]=(unsigned char)ALPHABET[w];}
 decoded[12]=0;received_type=data[9]>>5;return 0;
}
__attribute__((visibility("default"))) int js8_decode(void){
 received_type=-1;
 for(int i=0;i<174;i++)cw[i]=llr[i]>0;
 if(count_syndrome()==0&&unpack_result()==0)return 0;
 for(int c=0;c<87;c++)for(int j=0;j<7;j++){int v=check_nodes[c][j];v2c[c][j]=(v==255)?0:llr[v];c2v[c][j]=0;}
 for(int iter=0;iter<55;iter++){
  for(int c=0;c<87;c++)for(int j=0;j<7;j++){
   int v=check_nodes[c][j];if(v==255)continue;
   float minv=1e12f;int sign=-1; /* even parity: LLR>0 means bit 1, so baseline outgoing LLR is negative */
   for(int k=0;k<7;k++){if(k==j||check_nodes[c][k]==255)continue;float x=v2c[c][k];if(x>0)sign=-sign;float a=x<0?-x:x;if(a<minv)minv=a;}
   c2v[c][j]=sign*minv*.78f;
  }
  for(int i=0;i<174;i++)sums[i]=llr[i];
  for(int c=0;c<87;c++)for(int j=0;j<7;j++){int v=check_nodes[c][j];if(v!=255)sums[v]+=c2v[c][j];}
  for(int i=0;i<174;i++)cw[i]=sums[i]>0;
  if(count_syndrome()==0&&unpack_result()==0)return iter+1;
  for(int c=0;c<87;c++)for(int j=0;j<7;j++){int v=check_nodes[c][j];if(v!=255)v2c[c][j]=sums[v]-c2v[c][j];}
 }
 return -1;
}
#ifndef __EMSCRIPTEN__
void *memset(void *p,int x,unsigned long n){unsigned char *a=p;for(unsigned long i=0;i<n;i++)a[i]=(unsigned char)x;return p;}
void *memcpy(void *d,const void *s,unsigned long n){unsigned char *a=d;const unsigned char *b=s;for(unsigned long i=0;i<n;i++)a[i]=b[i];return d;}
#endif
