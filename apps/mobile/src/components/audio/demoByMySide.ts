import { generateId, parseRawLyrics } from '../../lib/lyricsUtils';

export const BY_MY_SIDE_RAW_LYRICS = `[00:15.00] ਜਦੋਂ ਜਾਗਾਂ ਹਰ ਸਵੇਰ ਤੇ ਸੌਵਾਂ ਹਰ ਰਾਤ | Jadon jaagan har sawer te sowan har raat | When I wake up every morning and sleep every night
[00:19.00] ਮੈਨੂੰ ਹਰ ਸਾਹ ਨਾਲ਼ ਆਵੇ ਤੇਰੀ ਯਾਦ | Mainu har saah naal aave teri yaad | With every breath, I remember you
[00:23.00] ਦਿਨ ਚੰਗੇ ਲੱਗਦੇ ਤੇ ਚੰਗੇ ਨੇ ਹਾਲਾਤ | Din change lagde te change ne halaat | The days feel good and the circumstances are right
[00:27.00] ਜਦੋਂ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Jadon kole tu hovein | When you are by my side
[00:31.00] ਮੈਂ ਤੈਨੂੰ ਲਵਾਂ ਦੇਖ, ਕੀ ਧੁੱਪ, ਬਰਸਾਤ? | Main tenu lavaan dekh, ki dhupp, barsaat? | I want to keep looking at you, be it sunshine or rain
[00:35.00] ਸਭ ਕੁੱਝ ਛੱਡ ਬੱਸ ਤੇਰਾ ਮੰਗਾਂ ਸਾਥ | Sab kujh chhad bas tera mangan saath | Leaving everything else, I just ask for your company
[00:39.00] ਇਹ ਦਿਲ ਵੀ ਏ ਤੇਰਾ ਤੇ ਤੇਰੇ ਜਜ਼ਬਾਤ | Eh dil vi ae tera te tere jazbaat | This heart is yours and so are the emotions
[00:43.00] ਨੀ ਬੱਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Ni bas kole tu hovein | Just that you are by my side
[00:47.00] ਤੇਰੀ ਤਸਵੀਰ ਨੂੰ ਦੇਖਾਂ ਮੈਂ ਰੋਜ਼ | Teri tasveer nu dekhan main roz | I look at your picture every day
[00:51.00] ਪਰ ਇਹ ਤੇ ਆਦਤ ਪੁਰਾਣੀ ਮੇਰੀ | Par eh te aadat purani meri | But this is an old habit of mine
[00:55.00] ਸੁਪਨੇ 'ਚੋਂ ਆਜਾ ਨਿੱਕਲ ਸਾਹਮਣੇ | Supne 'chon aaja nikal samne | Come out of my dreams into reality
[00:59.00] ਕਰਦੇ ਜੋ ਪੂਰੀ ਜ਼ੁਬਾਨੀ ਮੇਰੀ | Karde jo poori zubani meri | Fulfill the words I have spoken
[01:03.00] ਤੇਰੇ ਨਾ' ਜ਼ਿੰਦਗੀ ਦੇਖੀ ਏ ਜੋ | Tere naal zindagi dekhi ae jo | The life I have envisioned with you
[01:07.00] ਇੱਕ ਤੇ ਇਹ ਸੋਚ ਨਿਆਣੀ ਮੇਰੀ | Ikk te eh soch niani meri | It's just an innocent thought of mine
[01:11.00] ਤੇਰੇ ਤੋਂ ਸ਼ੁਰੂ ਹੈ, ਤੇਰੇ 'ਤੇ ਖ਼ਤਮ | Tere ton shuru hai, tere 'te khatam | It starts with you, and it ends with you
[01:15.00] ਹੈ ਤੇ ਬੱਸ ਐਨੀ ਕਹਾਣੀ ਮੇਰੀ | Hai te bas enni kahani meri | That is all my story is
[01:19.00] ਨਾ ਮੁੜਨਾ ਆਂ ਮੈਂ ਨੇ ਚੁਣੇ ਤੇਰੇ ਰਾਹ | Na mudna aa main ne chune tere raah | I won't turn back, I have chosen your paths
[01:23.00] ਨੀ ਤੈਨੂੰ ਸ਼ਾਇਦ ਸੁਣਕੇ ਲਾਗੂ ਅਫ਼ਵਾਹ | Ni tenu shayad sunke lagu afwah | You might hear this and think it's a rumor
[01:27.00] ਨੀ ਪਿਆਰ ਹੀ ਐ, ਵਾਅਦਾ ਮੇਰਾ ਪਿਆਰ ਹੈ ਵਫ਼ਾ | Ni pyaar hi ae, vaada mera pyaar hai wafa | It is love, my promise is that my love is loyal
[01:31.00] ਨੀ ਬੱਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Ni bas kole tu hovein | Just that you are by my side
[01:45.00] ਜਦੋਂ ਜਾਗਾਂ ਹਰ ਸਵੇਰ ਤੇ ਸੌਵਾਂ ਹਰ ਰਾਤ | Jadon jaagan har sawer te sowan har raat | When I wake up every morning and sleep every night
[01:49.00] ਮੈਨੂੰ ਹਰ ਸਾਹ ਨਾਲ਼ ਆਵੇ ਤੇਰੀ ਯਾਦ | Mainu har saah naal aave teri yaad | With every breath, I remember you
[01:53.00] ਦਿਨ ਚੰਗੇ ਲੱਗਦੇ ਤੇ ਚੰਗੇ ਨੇ ਹਾਲਾਤ | Din change lagde te change ne halaat | The days feel good and the circumstances are right
[01:57.00] ਜਦੋਂ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Jadon kole tu hovein | When you are by my side
[02:01.00] ਪਲ਼-ਪਲ਼ ਵੀ ਲੰਘਦੇ ਨੇ ਬੀਤੇ ਜੋ ਸਾਲ | Pal-pal vi langhde ne beete jo saal | Every moment passes like the years that have gone by
[02:05.00] ਬਿਨ ਤੇਰੇ ਔਖਾ ਏ ਲੱਗਦਾ ਸਮਾਂ | Bin tere aukha ae lagda samaan | Time feels difficult to pass without you
[02:09.00] ਭੁੱਖ ਨਾ ਲੱਗੇ, ਨਾ ਲੱਗਦੀ ਪਿਆਸ | Bhukh na lagge, na lagdi pyaas | I don't feel hungry, nor do I feel thirsty
[02:13.00] ਲੋਕੀ ਨੇ ਮਿਲ਼ਦੇ, ਮੈਂ ਕਰਦਾ ਮਨ੍ਹਾਂ | Loki ne milde, main karda manaa | People try to meet me, but I refuse
[02:17.00] ਗੱਲਾਂ ਨੇ ਕਰਨੀਆਂ ਤੇਰੇ ਨਾ' ਮੈਂ | Gallan ne karniyan tere naal main | I have to talk to you
[02:21.00] ਰਿਹਾ ਮੈਂ ਚੁੱਪ, ਹੋਈਆਂ ਜਮ੍ਹਾਂ | Riha main chup, hoiyan jamhaan | I stayed silent, and the words piled up
[02:25.00] ਤੇਰਾ ਨਾ ਆਉਣਾ ਨਾ ਹੁੰਦਾ ਏ ਸਹਿ | Tera na auna na hunda ae seh | I cannot bear it when you don't come
[02:29.00] ਬਿਨ ਤੇਰੇ ਜੀਣਾ ਨਾ ਚਾਹਵਾਂ ਜਮਾਂ | Bin tere jeena na chaahwan jama | I don't want to live without you at all
[02:33.00] ਜੇ ਅੱਖਾਂ ਕਰਾਂ ਬੰਦ ਤੇ ਸੁਣਦੀ ਆਵਾਜ਼ | Je akhan karaan band te sundi aawaz | If I close my eyes, I hear your voice
[02:37.00] ਤੂੰ ਗੱਲ ਮੇਰੀ ਮੰਨ, "ਥੋੜ੍ਹਾ ਕਰ ਲੈ ਲਿਹਾਜ਼" | Tu gall meri mann, "thoda kar lai lihaz" | Listen to me, "have some consideration"
[02:41.00] ਜੇ ਆਣਕੇ ਤੂੰ ਛੇੜੇਂ ਮੇਰੇ ਦਿਲ ਵਾਲ਼ੇ ਸਾਜ | Je aanke tu chhere mere dil wale saaj | If you come and play the strings of my heart
[02:45.00] ਬੱਸ ਤੂੰ ਹੀ ਤੂੰ ਹੋਵੇਂ | Bas tu hi tu hovein | Let it only be you
[02:49.00] ਜਦੋਂ ਜਾਗਾਂ ਹਰ ਸਵੇਰ ਤੇ ਸੌਵਾਂ ਹਰ ਰਾਤ | Jadon jaagan har sawer te sowan har raat | When I wake up every morning and sleep every night
[02:53.00] ਮੈਨੂੰ ਹਰ ਸਾਹ ਨਾਲ਼ ਆਵੇ ਤੇਰੀ ਯਾਦ | Mainu har saah naal aave teri yaad | With every breath, I remember you
[02:57.00] ਦਿਨ ਚੰਗੇ ਲੱਗਦੇ ਤੇ ਚੰਗੇ ਨੇ ਹਾਲਾਤ | Din change lagde te change ne halaat | The days feel good and the circumstances are right
[03:01.00] ਨੀ ਬੱਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Ni bas kole tu hovein | Just that you are by my side
[03:05.00] ਮੈਂ ਤੈਨੂੰ ਲਵਾਂ ਦੇਖ, ਕੀ ਧੁੱਪ, ਬਰਸਾਤ? | Main tenu lavaan dekh, ki dhupp, barsaat? | I want to keep looking at you, be it sunshine or rain
[03:09.00] ਹੋਰ ਸਭ ਛੱਡ ਬੱਸ ਤੇਰਾ ਮੰਗਾਂ ਸਾਥ | Hor sab chhad bas tera mangan saath | Leaving everything else, I just ask for your company
[03:13.00] ਇਹ ਦਿਲ ਵੀ ਏ ਤੇਰਾ ਤੇ ਤੇਰੇ ਜਜ਼ਬਾਤ | Eh dil vi ae tera te tere jazbaat | This heart is yours and so are the emotions
[03:17.00] ਨੀ ਬੱਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Ni bas kole tu hovein | Just that you are by my side
[03:21.00] ਨੀ ਬੱਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Ni bas kole tu hovein | Just that you are by my side
[03:25.00] 'ਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | 'S kole tu hovein | By my side
[03:29.00] ਨੀ ਬੱਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | Ni bas kole tu hovein | Just that you are by my side
[03:33.00] 'ਸ ਕੋਲ਼ੇ ਤੂੰ ਹੋਵੇਂ | 'S kole tu hovein | By my side`;

const parsed = parseRawLyrics(BY_MY_SIDE_RAW_LYRICS);

export const BY_MY_SIDE_DEMO_LYRICS = parsed.lines.map((line, index) => ({
  id: generateId(index, line.text || line.script || line.translation),
  original: line.text,
  romanization: line.script,
  translation: line.translation,
  time: line.startTime,
}));
