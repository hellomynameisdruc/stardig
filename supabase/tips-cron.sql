-- SYSTEM's tips on a clock that keeps time: the database posts them itself (pg_cron), twice a day,
-- 10:17 and 22:17 Kyiv winter time (08:17 and 20:17 UTC), one from a pool of 730 picked from the map
-- (a year's worth). GitHub's schedule ran hours late and skipped runs; this doesn't.
-- Run once in Supabase → SQL Editor. Needs stardig-system.sql (messages without a pilot) run before.

create extension if not exists pg_cron;

create table if not exists public.tip_pool (id bigint generated always as identity primary key, body text not null);
alter table public.tip_pool enable row level security; -- no policies: only the function below touches it

create or replace function public.post_tip() returns void
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select id, body into t from public.tip_pool order by id limit 1;
  if t.id is null then return; end if;
  insert into public.messages (pilot, room, body) values (null, 'all', t.body);
  delete from public.tip_pool where id = t.id;
end $$;
revoke execute on function public.post_tip() from public, anon, authenticated;

-- the pool: a fresh year of tips (running this again adds another year)
insert into public.tip_pool (body) values
('♪ Lenny Kravitz - Low (New Extended Single 2018) [Disco Mix VP Dj Duck] — Various
https://stardig.app/#sig-z_ApCLwDiLw.Disco'),
('♪ Clouds — Paul Blackford
https://stardig.app/#sig-DAFNmWe5W_s.Chillwave'),
('♪ Tambo Nickodemus Remix — Ghetto Kumbé
https://stardig.app/#sig-6qzKmkkRv-E.Bass%20Music'),
('♪ Kids of Yesterday — Martwy Robot Projekt
https://stardig.app/#sig-rSHrCdE1sVI.Acid%20Jazz'),
('♪ Fabricated — DJ Wank
https://stardig.app/#sig-zubTW6OiENo.Acid'),
('♪ Tanokumbia — The Halluci Nation
https://stardig.app/#sig-1EpYfiQj7EU.Dubstep'),
('♪ I Am... the Assassin of Gods — Chaostar
https://stardig.app/#sig-cKCw4rRcNCA.Modern%20Classical'),
('♪ World Unknown (My Mixx Is Dunn) — DJ Empirical
https://stardig.app/#sig-fQrDqNe8u1M.Acid%20House'),
('♪ De La Casa (Stateside Remix) — E.K.O.
https://stardig.app/#sig-m-LuUY4UXQ4.Breaks'),
('♪ Geschmack Und Funktion — Hanno Leichtmann
https://stardig.app/#sig-K-iXsJdiEoo.Drone'),
('♪ Raised By The Street — DRS & Pinotello & Madsin
https://stardig.app/#sig-G2t7HriSxWI.Hardcore'),
('♪ Benz Bargain Bin Bossa — Mr. Confuse & Daytoner & DJ Benz
https://stardig.app/#sig-lUI26L2v2Oo.Breaks'),
('♪ Sailor Man — Mordillo
https://stardig.app/#sig-6sJN98L-Jug.Boogie'),
('♪ Different Perspectives — Lilith
https://stardig.app/#sig-llPIiKzC5Rc.Psy-Trance'),
('♪ 81948 (2000 OM69) — Sissi Rada
https://stardig.app/#sig-X4lb1g2GGc0.Krautrock'),
('♪ Tripartite — Various
https://stardig.app/#sig-DPntl-PMY44.Goa%20Trance'),
('♪ Always In My Dreams — Supreme & UFO
https://stardig.app/#sig-Zwdm69I48qg.Happy%20Hardcore'),
('♪ Dawn (Andy Blake Remix) — 27 Sundays
https://stardig.app/#sig-hpTnHEfkumY.Electro'),
('♪ Welcome To The Land Of Gabber — Rob Gee
https://stardig.app/#sig-U80garUdJa8.Hardcore'),
('♪ Tuvok — Blair Bitch
https://stardig.app/#sig-ht38o9BAWao.Trance'),
('♪ Intro — Smash?
https://stardig.app/#sig-GEyy-lUgI3o.Gabber'),
('♪ States Of High — Various
https://stardig.app/#sig-Ovm5b-REe0Y.Minimal'),
('♪ Slow & Steady Wins The Race — Various
https://stardig.app/#sig-kAwRpepOmbc.Breakbeat'),
('♪ Christopher S. feat. Antonella Rocco "the rhythm of the night" (Mike Candys Revenge Mix) DS-DA 10-10 — Christopher S. & Antonella Rocco
https://stardig.app/#sig-RaeJxtZMZ-0.Electro'),
('♪ Crescent Dunes — Various
https://stardig.app/#sig-k9XlSSTzSlM.IDM'),
('♪ Daisy''s (Remix) 1996 — Wickee
https://stardig.app/#sig-1eyjiJxVilY.Hard%20Trance'),
('♪ Untitled — Unknown Artist
https://stardig.app/#sig-gdvsAwyfh0Y.Acid%20House'),
('♪ Leptodus Americanus — Samson Simeon
https://stardig.app/#sig-iSOMxheWjjY.Vaporwave'),
('♪ Give Me Your Love (Let''s Talk About It) — Lahma Davis
https://stardig.app/#sig-BXXevPphMHw.Hip-House'),
('♪ Turn Up The Pass — Various
https://stardig.app/#sig-tbiuknuZf_U.Breakcore'),
('♪ Voglkio una donna ......ho una fame della madonna — Los Marineros
https://stardig.app/#sig-WRPJmdRhOMg.Chanson'),
('♪ Honest Dub (Album 2016 Screaming Target RMX&DUB By Higher Light) — Big Youth
https://stardig.app/#sig-314vpVLTli8.Dub'),
('♪ Velvet Night — Tommy The Cat
https://stardig.app/#sig-DYLZukmUEqU.Jungle'),
('♪ Baby Come Back — Various
https://stardig.app/#sig-K1rTS4ekyIg.Freestyle'),
('♪ Sweet Asylum — Sweet Asylum
https://stardig.app/#sig-asTHcsWmd14.Hard%20House'),
('♪ Heaven & Hell — Future Synth
https://stardig.app/#sig-ndIfyIu8UvM.Synth-pop'),
('♪ Trancemaster 2007 — Various
https://stardig.app/#sig-oUzQogHGAuA.Hard%20Trance'),
('♪ A.K.A. (Sam Mix) — Sander van Doorn
https://stardig.app/#sig-hmVVEJbsJ70.Electro%20House'),
('♪ His Latest Flame — The Residents
https://stardig.app/#sig-QaPsl1DOOVQ.Avantgarde'),
('♪ For Sure (Main Mix) — CJ Reign
https://stardig.app/#sig-PJkGAKc0TXU.Garage%20House'),
('♪ Neid (Keen K Remix) — P24
https://stardig.app/#sig-6r9SGA2ca0E.EBM'),
('♪ Mariyammal — Duhkha
https://stardig.app/#sig-Haq0l4cq374.Musique%20Concr%C3%A8te'),
('♪ Behemoth — Joe Ford
https://stardig.app/#sig-E4tM9NjGXXc.Drum%20n%20Bass'),
('♪ So You Decided To Become A Dumb Goth (Shit) — Psyence Fiction
https://stardig.app/#sig-BfbHMd4Oir4.EBM'),
('♪ Cross Faded — NXSTY & Loca
https://stardig.app/#sig-aJB43CuOwbw.Dubstep'),
('♪ NAV (1995) — Bigeneric
https://stardig.app/#sig-OOByw3YCIqI.IDM'),
('♪ Somewhere In Space — Various
https://stardig.app/#sig-21V8KBz4WIE.Goa%20Trance'),
('♪ No Escape From The Silent Six — The Voltage Club
https://stardig.app/#sig-TKfdgAlBboY.Hard%20Trance'),
('♪ Kuril Probe — Kabutogani
https://stardig.app/#sig--rFmMYgg6q0.Glitch'),
('♪ Coming Up [Official Audio] — Modeā
https://stardig.app/#sig-juC808Bks8U.Techno'),
('♪ Love Letters To The Soul — Entheogenic
https://stardig.app/#sig-ieELLS1djHM.Goa%20Trance'),
('♪ Without You (Will Atkinson Remix) [#ASOT830] — Dogzilla
https://stardig.app/#sig-x_u2L7roLbM.Progressive%20Trance'),
('♪ Ghostbusterz — Slipz
https://stardig.app/#sig-ecVaUapgXPE.Drum%20n%20Bass'),
('♪ Hardstyle Invaders 5 CD1 Track 9-17 — Various
https://stardig.app/#sig-25XPXEDOkx4.Hardstyle'),
('♪ Décris La Moi — Pierre Desprats
https://stardig.app/#sig-Ehx9PACxVtw.Soundtrack'),
('♪ accuface journey into sound — Accuface
https://stardig.app/#sig-TASEWkISIBg.Hard%20Trance'),
('♪ Endless Love 2005 (Cosmic Culture Mix) — DJ Moe & Yoba
https://stardig.app/#sig-3VSy9DYF73s.Hands%20Up'),
('♪ Bunter Hund — Mathias Schaffhäuser
https://stardig.app/#sig--S4KF0_kk6E.Minimal'),
('♪ Written In Stone — Endah & Sour
https://stardig.app/#sig-ZYCg0u9OYpw.Hard%20Trance'),
('♪ Flyaway — Various
https://stardig.app/#sig-DBzZBO-Qodg.Minimal%20Techno'),
('♪ Da-Nu-Deal — Akira
https://stardig.app/#sig-nJNyr79HbLw.Drum%20n%20Bass'),
('♪ Disposable — KFC Murder Chicks
https://stardig.app/#sig-0iMPqvEncXY.Rhythmic%20Noise'),
('♪ Further — ATTLAS
https://stardig.app/#sig-h5gUszf11v0.Electro%20House'),
('♪ Love Again — Zara Larsson
https://stardig.app/#sig-00S6n8TBKDs.Europop'),
('♪ SWV - Right Here (Human Nature Radio Mix) — Various
https://stardig.app/#sig-1WFD8mqxufI.Breakbeat'),
('♪ Tortoise - Along the Banks of the Rivers — Various
https://stardig.app/#sig-nLrZI_yIRrw.Alternative%20Rock'),
('♪ Malta (Extended) — Leroy Moreno
https://stardig.app/#sig-YeGDksyPOUQ.Trance'),
('♪ Suck The Box — Lonny & Melvin White
https://stardig.app/#sig-EvoHI0KUid8.Electro'),
('♪ Highstreet feat Black Male   You Leave The House — Highstreet & Black Male
https://stardig.app/#sig-jGRJp-y43Dk.Italo-Disco'),
('♪ Seas Of Stones And Sand — Bvdub & Netherworld
https://stardig.app/#sig-sIvTTWJDqAE.Drone'),
('♪ Cry For You — Soul Intent
https://stardig.app/#sig-3cPZ8YAVhw4.Drum%20n%20Bass'),
('♪ Breakfast In Bratislava — Ben Sims
https://stardig.app/#sig-DfW7vrB5E9Y.Techno'),
('♪ Cyberbeat — Techniques Berlin
https://stardig.app/#sig-8vv9321Gjhw.EBM'),
('♪ Rule The World — Ilan Bluestone
https://stardig.app/#sig-2WA_NA1kg8g.Progressive%20Trance'),
('♪ Paradise Latex — Brando Lupi
https://stardig.app/#sig-TYaTMeKHs48.Minimal'),
('♪ Bubblegum — Crypticz & Lakeway
https://stardig.app/#sig-uZKX2pC-y_Y.Jungle'),
('♪ Caresse Mon Esprit — Mr. Moods
https://stardig.app/#sig-D2gjveXSe-0.Trip%20Hop'),
('♪ Everybody Sells Cocaine — Motionless In White
https://stardig.app/#sig-9QOU-pyvfbA.Dubstep'),
('♪ Flight To Paradise (Dance Version) — Low Rider
https://stardig.app/#sig-oHkpg_KwN6s.Italo-Disco'),
('♪ Homesick™ (2017) [Full Cassette Rip] — MindSpring Memories
https://stardig.app/#sig-aI79qZCq4-A.Vaporwave'),
('♪ Blow Your Brain — Karun
https://stardig.app/#sig-EHu0Me2hYb8.Hardcore'),
('♪ Corner Boy — TYVYT|IYTYI
https://stardig.app/#sig-YzTvjjTeM-g.EBM'),
('♪ Twist Of Love — Kimberly Davis
https://stardig.app/#sig-UqpYbsaxvxk.Tribal%20House'),
('♪ Minotaur Shock (featuring Louise Davis) // Lady Came From Baltic Wharf // HD — Various
https://stardig.app/#sig-g7FDLHLhbgg.IDM'),
('♪ The Vision (Vaporized Remix) — Kristian Thinning & DJ Cosmix
https://stardig.app/#sig-8G1Hc4yfl8k.Goa%20Trance'),
('♪ XTC — DJ Spy
https://stardig.app/#sig-e-H-sV0Hjy8.Goa%20Trance'),
('♪ Ryder & Bleasdale - Cream Separates 03 — Les Ryder & Paul Bleasdale
https://stardig.app/#sig-W203IxF1C1g.House'),
('♪ In Gravitational Floor of a Blue Comet — Vacuum Stalkers
https://stardig.app/#sig-ds_kA5QXYB4.Psy-Trance'),
('♪ Annopod — Various
https://stardig.app/#sig-r6QYu7aEHVc.Techno'),
('♪ Colour Blind — Slamma
https://stardig.app/#sig-3IFT9faVItI.Happy%20Hardcore'),
('♪ Darkness & The Light (Matt''s Vocal Mix) — Matt Warren
https://stardig.app/#sig-2GfFo_xgT8s.House'),
('♪ Stay Together (Official Video) — Mandaryna
https://stardig.app/#sig-4WC7v4oB0_4.Euro%20House'),
('♪ Epopee — Vesal Javaheri
https://stardig.app/#sig-C-OWDbsdwLs.Noise'),
('♪ Laira Detop — Geiom
https://stardig.app/#sig-4V12sAbbEho.IDM'),
('♪ Pure Energy (Ruffian Squad Mix) — Dead Man''s Chest & Tim Reaper
https://stardig.app/#sig-AEbhVdTz8l0.Jungle'),
('♪ Broken Echoes (Extended Mix) — NyTiGen
https://stardig.app/#sig-6X_X3YnrkNQ.Trance'),
('♪ FUNK THAT (OCHOA''S PERCUSIVE MIX) — Mario Ochoa
https://stardig.app/#sig-ntqAgBjPDWM.Tech%20House'),
('♪ Disco For Life - 2004 A45 Music Germany — Roxbury 54 & Dino
https://stardig.app/#sig-AztsPf7nBjc.Euro%20House'),
('♪ Catch Me — Tomorrow''s World
https://stardig.app/#sig-Bk4fIqA5gRE.Downtempo'),
('♪ Mary Ashford Music — Jan Steele & Ziz ! Ensemble
https://stardig.app/#sig-5dxKoLAVPHc.Experimental'),
('♪ Unit 2 ‎– Keep Your Head Up (2 fu Glasgow House Mix) — Unit 2
https://stardig.app/#sig-MnMm5OLfZR8.Techno'),
('♪ It''s About Time (Boogie Man Mix) — Mix Masters & MC Action
https://stardig.app/#sig-zKVEznbYJuQ.Techno'),
('♪ Drift — Aube
https://stardig.app/#sig-totkTxmjFg0.Noise'),
('♪ Star Of Love — Anima
https://stardig.app/#sig-QGKVS2Artsw.Electro%20House'),
('♪ Man In A Hat — Various
https://stardig.app/#sig-xGmgLPOHfFE.Punk'),
('♪ Let It Go — Claw
https://stardig.app/#sig-FDsQFwQDavM.Happy%20Hardcore'),
('♪ Nerubian Trip — Negru
https://stardig.app/#sig-r6yfmA2qd2g.Minimal%20Techno'),
('♪ Heat On The Dancefloor (Extended Mix) — HEAVEN42
https://stardig.app/#sig-XqhlWz7IBpc.Euro-Disco'),
('♪ Aquamarine (Neutral Point Oceanic Remix) — Up & Forward
https://stardig.app/#sig-PbrXx97x8rk.Trance'),
('♪ Legend — 4th Dimension
https://stardig.app/#sig-diBetew8DO4.Psy-Trance'),
('♪ Wind Up — Ian M
https://stardig.app/#sig-IE8akX3COyk.Hard%20House'),
('♪ Dub House — Sector 7
https://stardig.app/#sig-nsiQvV_smUA.Psy-Trance'),
('♪ Attitude — Havoc
https://stardig.app/#sig-orw_X2bK6fY.Industrial'),
('♪ B2S — Low & Lee
https://stardig.app/#sig-kDMmD55JsbU.Hardstyle'),
('♪ Shoot The Dog — George Michael
https://stardig.app/#sig-ABhZQ_VRbsQ.Vocal'),
('♪ Reload (Radio Edit) — Phazer & Cubix
https://stardig.app/#sig-qyx-fzryeZ8.Hardstyle'),
('♪ My Sound  — Indy Boca & Footprint System & Daman & Brizion
https://stardig.app/#sig-JdeSimC0OW8.Dub'),
('♪ Norwood B   Your On The One Your On The Money) — Norwood
https://stardig.app/#sig-RlqYR03rC_I.Disco'),
('♪ Band Of Gold — Sylvester
https://stardig.app/#sig-Ps9kogfKSH0.Hi%20NRG'),
('♪ DEFORMER Inner-Outcast — Deformer
https://stardig.app/#sig-Pb1SVq_yXsM.Breakcore'),
('♪ Bad Luck — B.P. Johnson
https://stardig.app/#sig-n4XHX92v8ac.House'),
('♪ Terrified but Hopeful - Negative Zero (Full Album) — Negative Zero
https://stardig.app/#sig-62C_WTgFxzU.Punk'),
('♪ DMM - The Spring 92 Selection (1992) — Various
https://stardig.app/#sig-ARK-LtEi0NI.Euro%20House'),
('♪ Baby Anne - Ground N Pound [FULL MIX] — DJ Baby Anne
https://stardig.app/#sig-OOgXPBWK--I.Tribal%20House'),
('♪ T - Up - Luv Unconditional   *T- Rock Da Bells Mix* — T-Up
https://stardig.app/#sig-yRLZZd7OtO8.Italo%20House'),
('♪ There''s A Party In My Head — MrSimon
https://stardig.app/#sig-JeEfbd8O1ZA.Breakcore'),
('♪ Director''s Cut — Krötenlecker
https://stardig.app/#sig--y_g8KAp0_4.Leftfield'),
('♪ [DuneHS3003] 909 Resistance : Dune Hs3003 — 909 Resistance
https://stardig.app/#sig-mbUj3DNQOyw.Freetekno'),
('♪ ROBBIE NEVIL Wots It to Ya 1986 — Robbie Nevil
https://stardig.app/#sig-klMoFNmxNmY.Synth-pop'),
('♪ Sweet — Betty Wright
https://stardig.app/#sig-f0P6GamH4Uc.Soul'),
('♪ Sweet Hour [ENXPL04] — Felisha Ledesma
https://stardig.app/#sig-g5WUQf5b8ho.New%20Age'),
('♪ Shrine West — Forest Swords
https://stardig.app/#sig-_TP0Bpji0ec.Leftfield'),
('♪ Nditsheni Ndi Di Phine — Irene Mawela
https://stardig.app/#sig-z-2fA-wupi0.Disco'),
('♪ Dark Impulses — Various
https://stardig.app/#sig-LB7GwhKkfw0.Drum%20n%20Bass'),
('♪ Timeout — Tom Thiel
https://stardig.app/#sig-z9huGEB-3bs.Ambient'),
('♪ Capital — Shlømo & Kmyle
https://stardig.app/#sig-ct_-5vA_W4g.Techno'),
('♪ Raw Head — Various
https://stardig.app/#sig-Q4o_i0bkIRI.Darkwave'),
('♪ Best of Bad Boy Bill Dj Live @THE CROBAR — Bad Boy Bill
https://stardig.app/#sig-B35qaOwrDLg.Happy%20Hardcore'),
('♪ utopia cloak -- it''s done — Utopia Cloak
https://stardig.app/#sig-uxA4RiwkWZE.IDM'),
('♪ Lei Verrà — Mango
https://stardig.app/#sig-z_SuFUyBBkk.Italo-Disco'),
('♪ Just Come (Pink Devil Version) — Various
https://stardig.app/#sig-308pAgFrqvo.Hardcore'),
('♪ Closer To You — Sied van Riel & R.O.R.
https://stardig.app/#sig-9A6A8fNeJ24.Trance'),
('♪ Narsis — Masaaki Kikuchi
https://stardig.app/#sig-WOsowchSScY.Experimental'),
('♪ You Broke Me — Glaring
https://stardig.app/#sig-qbyw0aBVFkE.Post-Punk'),
('♪ House is Mine (Casper Pound Remix).wmv — The Hypnotist
https://stardig.app/#sig-V35hlkhjIPQ.Acid'),
('♪ Batbit V2 (Roberto Ayensa Remix) — Hyo
https://stardig.app/#sig-r8T2QMJmyEQ.Techno'),
('♪ Playin'' (Fourth Mix) — The Movers
https://stardig.app/#sig-rwx9Jzd-Knw.House'),
('♪ Glitter Ball Boy (Punx Soundcheck Remix) — Frau-Doktor
https://stardig.app/#sig-VsUPIhEV7Xs.Synth-pop'),
('♪ Time — Various
https://stardig.app/#sig-p51616Y-8wE.Jungle'),
('♪ Beetle Battle — Frank Biedermann
https://stardig.app/#sig-sbeu-sjUzTg.Minimal'),
('♪ Pressure Relaxation — Mr. Zoth And The Werespiders
https://stardig.app/#sig-4Mx08AoDROE.Dark%20Ambient'),
('♪ (B)APE SOUNDS (2004) [Full Album] — Nigo
https://stardig.app/#sig-hiJIN7ZlWOg.Hip%20Hop'),
('♪ Splende La Notte — Adriano Celentano
https://stardig.app/#sig-XBMKeBejaC0.Chanson'),
('♪ Black Countess Eleanors desire — Black Countess
https://stardig.app/#sig-TeDPE0Gypx0.Dark%20Ambient'),
('♪ What Cha Gonna Do With My Lovin'' (12" Version) (Slayd5000) — Stephanie Mills
https://stardig.app/#sig-OY5qTKBb9XM.Funk'),
('♪ Fear — The Elephant Breath
https://stardig.app/#sig-3bSXl7YbSfA.Trip%20Hop'),
('♪ Fashion Drug — Julia Louise KnifeFist
https://stardig.app/#sig-CuyouuPMwPk.IDM'),
('♪ Nightride — Elenoir
https://stardig.app/#sig-uIH1dT_Q9lQ.Chanson'),
('♪ Street Shit — DJ Trupchinov
https://stardig.app/#sig-KoLntgy1MB8.Hardcore'),
('♪ Smacker (The Face Mix) — Digital Nature & Vascotia & Michel Van Tune
https://stardig.app/#sig-hy6jX3wobc8.Progressive%20Trance'),
('♪ Grüner Samt — Marsimoto
https://stardig.app/#sig-aNYL6N5a-VE.Hip%20Hop'),
('♪ Hydraulix (Sleepfreaks Remix) — The Cybermen
https://stardig.app/#sig-EaAvVF1axHQ.Progressive%20House'),
('♪ Dje Djaka Dambé — Various
https://stardig.app/#sig-HsmA8AOjtjA.Hardcore'),
('♪ Baba Hooker — Zap Mama
https://stardig.app/#sig-19o6xtafuZA.Latin'),
('♪ Alarm! — Various
https://stardig.app/#sig-PAI0jaFdQHc.Hardcore'),
('♪ RIP Groove Vs Tina Moore White Label — Double 99 & Industry Standard & Tina Moore
https://stardig.app/#sig-8xknxLtMM0c.Euro%20House'),
('♪ Capacitor — Simple Circuit
https://stardig.app/#sig-5KCN6Hmjo0E.Dubstep'),
('♪ There Was A Time — Floorplan
https://stardig.app/#sig-GJXkiFdXkuQ.Deep%20House'),
('♪ Logic Obscene — Various
https://stardig.app/#sig-xKceMvenR8A.Darkwave'),
('♪ Retro (Down The Club Mix) — Tommy Pulse & Oxygen
https://stardig.app/#sig-tQHpWEFecCY.Trance'),
('♪ Not The Loving Kind — The Twins
https://stardig.app/#sig-WCzArhHQOTU.Disco'),
('♪ The Pull of a Heavy Centre — Various
https://stardig.app/#sig-t_g1nFRbIS8.Dub'),
('♪ Domenicer   Traci Lords (Porn star) — Domenicer
https://stardig.app/#sig-IAjGFKHGnZc.Europop'),
('♪ [32]  B2 - POM POM — Pom Pom
https://stardig.app/#sig-1zPYtzD4vXY.Minimal'),
('♪ How Many DJ''s — DJ Devistada
https://stardig.app/#sig-2bxRdqE00S8.Jungle'),
('♪ SYSdrum — Mono Junk & Mesak
https://stardig.app/#sig-wFW67MuFsiA.Acid'),
('♪ トレーニングスペース / Training Room — Soichi Terada & Soichi Terada
https://stardig.app/#sig-brSdw5nqeg8.Downtempo'),
('♪ Take A Chance — Max Black & Robert White
https://stardig.app/#sig-ffa1Jp77mdk.Italodance'),
('♪ Ask Me To Dance (feat. Sassy Alan) (Jimmy Michaels 1979 Disco Mix) — Marcia Elder
https://stardig.app/#sig-nn2HlPYU_Io.Disco'),
('♪ Let´s Rock — Paul Johnson
https://stardig.app/#sig-Z-Ngz0F7v1o.House'),
('♪ Rough Embrace — Emilía
https://stardig.app/#sig-OUCGJ0zSavY.Folk'),
('♪ Funk 80 Only The Best Rare Track Vol 1 by MAGIC DRIX 974 — Various
https://stardig.app/#sig-RKPbQnwn0vg.Soul'),
('♪ Clunk — Solix
https://stardig.app/#sig-FELzGNBkn88.Drum%20n%20Bass'),
('♪ Star — Terra Nine
https://stardig.app/#sig-F1ZpwxHHgyc.Downtempo'),
('♪ Slider (Full Circle Mix) — The Paingang
https://stardig.app/#sig-Oat_wpCiWLo.Progressive%20House'),
('♪ London acid city ( 2006 remix ) — Lochi
https://stardig.app/#sig-BOWBYa2tU_c.Acid'),
('♪ High-Voltage — Q''Bass
https://stardig.app/#sig-lyhltg7nAi8.Trance'),
('♪ "Vertigo Mixed" - 02 — Andy Votel
https://stardig.app/#sig-hpREtL7X290.Pop%20Rock'),
('♪ Original Skankster — Soundbox
https://stardig.app/#sig-fj4kI4AjeHM.Dubstep'),
('♪ Manches Ist OK — Ampl:tude
https://stardig.app/#sig-UVOiHRaqOhc.Post-Punk'),
('♪ Tonight You''ll See — Jaya
https://stardig.app/#sig-mRiODS5r9IM.Freestyle'),
('♪ No One — Maurice Joshua
https://stardig.app/#sig-gmU45rnuDpQ.Garage%20House'),
('♪ New Hope — Petar Dundov
https://stardig.app/#sig-OS95WcnRQYI.Techno'),
('♪ Bobby D'' Ambrosio Girl You Need A change of Mind Louis Benedetti Club Mix — Bobby D''Ambrosio & Arif St. Michael
https://stardig.app/#sig-fUdkuz3yiD8.Garage%20House'),
('♪ In The Dark — Guardelion
https://stardig.app/#sig-v5jDJJF5hek.Hardstyle'),
('♪ Home Is Home — Zack & Gebah
https://stardig.app/#sig-fUqeF1Ta3Cw.Boogie'),
('♪ 星になれた(LIVE)/ゆらゆら帝国 — Yura Yura Teikoku
https://stardig.app/#sig-KkcSwft_LXA.Psychedelic%20Rock'),
('♪ Supa Dupa — De Mosselman
https://stardig.app/#sig-jN_W7t9fC4c.Gabber'),
('♪ One To Another — Various
https://stardig.app/#sig-yXs8zmfqXvg.RnB%2FSwing'),
('♪ Environmental Influences — Dots On The Sun
https://stardig.app/#sig-YU705uH5RXA.Leftfield'),
('♪ Luminance (Size Pier Remix) — SpunOff
https://stardig.app/#sig-lNrcY4npblA.Industrial'),
('♪ Gatekeeper  — Psycode
https://stardig.app/#sig-J107v9lfZEI.Psy-Trance'),
('♪ I Don´t Know — Marc Korn & Semitoo
https://stardig.app/#sig-PfxtWnMoJ4Q.Happy%20Hardcore'),
('♪ Shifted — Various
https://stardig.app/#sig-yVMW7fuehog.Goa%20Trance'),
('♪ Infiltration Of Love — Silent Signals
https://stardig.app/#sig-2wMvzJxpKeo.Minimal'),
('♪ Do You Feel Me (Club Mix) — NY''s Finest
https://stardig.app/#sig-kFbH0iXwylA.Garage%20House'),
('♪ Little Closer (Extended Mix) — Matt Fortress
https://stardig.app/#sig-Axww8hKFrx8.Electro%20House'),
('♪ Руки Вверх! - Ай-яй-яй @ Олимпийский, 2018 — DJ Дождик & Айдамир Мугу & Ахра & Верка Сердючка & Игорёк & Фактор-2 & Бьянка & Банд''Эрос & Vengerov & Fedoroff & Чи-Ли & МакSим
https://stardig.app/#sig-JZiywmdMJM8.RnB%2FSwing'),
('♪ I''m OK — The Melodyst
https://stardig.app/#sig-AMYvWx5_6L8.Gabber'),
('♪ Flame Of June — Darwin
https://stardig.app/#sig-Q97FUYsXaQ4.Happy%20Hardcore'),
('♪ Wo Bist Du Hin — Patrick Arbez & Marika
https://stardig.app/#sig-ZeYdLpZaM0o.Minimal'),
('♪ Wakà Zià — Jan Kisjes
https://stardig.app/#sig-pfQ4A5KL0vk.New%20Age'),
('♪ Got It Like That — Second Hand Audio
https://stardig.app/#sig-Ym6hOiNI05M.Hip%20Hop'),
('♪ MACHINE SAYS YES! — FC Kahuna
https://stardig.app/#sig-12PcJQ_XcZQ.Electroclash'),
('♪ Lollercoaster [Kinda Funny Remix] — BSOD
https://stardig.app/#sig-58xtu2YxX-4.Hard%20House'),
('♪ Ristorante Di Lusso — Carlo D''Este
https://stardig.app/#sig-mVN9dVjy1UY.Italo-Disco'),
('♪ Cuernos Cubanos — Spektre & Matt Cooper
https://stardig.app/#sig--iiLdICP9xY.Techno'),
('♪ 2012 — Various
https://stardig.app/#sig-SztS9pOIjys.Psy-Trance'),
('♪ Guru — Various
https://stardig.app/#sig-XwWfb-4J874.Goa%20Trance'),
('♪ I Married the King''s Daughter — Mr 3
https://stardig.app/#sig-cY3ebHDNBSY.Lo-Fi'),
('♪ Speed Up — Teo Moss & Jeremy Reyes
https://stardig.app/#sig-LjPfTxOmTn8.Electro'),
('♪ Cinderella — Miss Papaya
https://stardig.app/#sig-CfvlJmlDo5s.Euro%20House'),
('♪ Schopenhauer — Rocco Caine
https://stardig.app/#sig-yrKXakqluAU.Minimal'),
('♪ Show Me (Love Me Love Me Love Me) (Club Mix) — Sissoko
https://stardig.app/#sig-nQefTSXBhUw.Italodance'),
('♪ Natalie''s (Flat Progressive) — J.C. Trance & Lucifer
https://stardig.app/#sig-VTh6sJDUm2A.Trance'),
('♪ Psychopathic Evil — D-Ceptor
https://stardig.app/#sig-0odJw1vziwo.Hardcore'),
('♪ True Lies (Original Mix) — Arnej
https://stardig.app/#sig-4oaSOWxqsy0.Progressive%20Trance'),
('♪ You Said Forever — Lerosa
https://stardig.app/#sig-8heMhLNNXoI.Deep%20House'),
('♪ What Are You Gonna Do (Smack Dub) — Pseudo
https://stardig.app/#sig-U1VlKlngTtk.Garage%20House'),
('♪ He Wants To Get Away — Mayka In Ku
https://stardig.app/#sig-0defQqAki6A.Europop'),
('♪ Carillon — Callisto & Cressida
https://stardig.app/#sig-zmXKT2zdJ8c.Progressive%20Trance'),
('♪ Baby Decide — Various
https://stardig.app/#sig-Z5fT1OvoT4E.Eurobeat'),
('♪ ფსიქეა — Various
https://stardig.app/#sig-Yasx6H555Hs.Ambient'),
('♪ Futile — Johnny Fiasco
https://stardig.app/#sig-1kzK3eNfQ1g.House'),
('♪ Deeper Love — AØRA Välen
https://stardig.app/#sig-jRd-Di3bblk.Dance-pop'),
('♪ Tell U Something — Maniba
https://stardig.app/#sig-0Mx5B9rUbws.House'),
('♪ Ganjaman — Dreadzone
https://stardig.app/#sig-JT-XF53FFSY.Dub'),
('♪ Zombieland — Al Storm
https://stardig.app/#sig-apl68GvkT0Y.Happy%20Hardcore'),
('♪ Diskotekk (So.T Remix) — Timewarp inc.
https://stardig.app/#sig-OKBG8LJbcb8.Broken%20Beat'),
('♪ Kajra Mohabbat Wala (Acappella) — Coldcut & On-U Sound & Hamsika Iyer
https://stardig.app/#sig-vtbtE6S3eEw.Breakbeat'),
('♪ Sunrise At 9 (Progressive Touch) — Godazia
https://stardig.app/#sig-49-6SGn8svk.Hard%20House'),
('♪ Death Tones — Prolaps
https://stardig.app/#sig-gIay_gIRJAo.Drone'),
('♪ 二 Money Towers — Lydmor
https://stardig.app/#sig-1KXxUOnRXB0.Synth-pop'),
('♪ Hacid I-HtA — Ty Acid
https://stardig.app/#sig-yzwiIAk6JVE.Electro%20House'),
('♪ TDK Strut — REQ & Rob Euroh
https://stardig.app/#sig-C_QKjtKMWwA.Experimental'),
('♪ Melting Down — Various
https://stardig.app/#sig-wwcttm39QdU.Drone'),
('♪ Perfect Circle — Cerrone
https://stardig.app/#sig-mRrRAzjtJrw.Disco'),
('♪ Sign Of Life (Radio Edit) — Ti-Mo
https://stardig.app/#sig-tddZ980C260.Hands%20Up'),
('♪ Throw Down — Various
https://stardig.app/#sig-AMjM5HgqnO4.Soul'),
('♪ Feelings Of Love — P.V
https://stardig.app/#sig-rpSStXUYrYQ.Glitch'),
('♪ Don''t Go (Remix ''91) — Various
https://stardig.app/#sig-Is4bxVYrtC4.Hip-House'),
('♪ 313 Bass Mechanics — 313 Bass Mechanics
https://stardig.app/#sig-VHigOsafzr0.Electro'),
('♪ Computer Breath (2000 Unreleased Mix) — S.U.N. Project
https://stardig.app/#sig-SlGA4mMDvWk.Goa%20Trance'),
('♪ Defender — Tesen & Profile
https://stardig.app/#sig-whNklk0K26Q.Drum%20n%20Bass'),
('♪ Dreamin — Dom Dolla & Daya
https://stardig.app/#sig-29rv1ClG6js.Tech%20House'),
('♪ Ff (Blue Peter''s Sos Mix) — Razor''s Edge
https://stardig.app/#sig-K0hxxzlTC84.Hard%20Trance'),
('♪ Schysteemi (Megamix) — Hausmylly
https://stardig.app/#sig-6pTjedseQCc.Euro%20House'),
('♪ Aligning The Daemon — Monolake
https://stardig.app/#sig-qG5-7xZvSiM.Abstract'),
('♪ Running Number — Moodtrax
https://stardig.app/#sig-SOE1ywKKalQ.Deep%20House'),
('♪ JLY 023 EP B2 Elektrophonica — Valentino Kanzyani
https://stardig.app/#sig-Exm44PIMybk.Tech%20House'),
('♪ Tag Und Nacht — Sebastian Hämer
https://stardig.app/#sig-IFh8qj-UaLE.Big%20Beat'),
('♪ Signals Of Sin — David Mandelberg
https://stardig.app/#sig-tZWWl3PvkCk.Abstract'),
('♪ Lost In Paradise  — Benzoo
https://stardig.app/#sig-xahyLMyP-88.Psy-Trance'),
('♪ Kumharas — DJ Peluka
https://stardig.app/#sig-_kg4kFuJ2WA.Breaks'),
('♪ Electric Sea — Gianni Maselli
https://stardig.app/#sig-OHoCKr0XEQ4.Italodance'),
('♪ Requiem Again — The Durutti Column
https://stardig.app/#sig-pFxplh0OHV8.Hard%20Trance'),
('♪ Early Winter — Various
https://stardig.app/#sig-GA-s9JpTNJk.Deep%20Techno'),
('♪ The Black Ruby Of Voldesad — Jamie Stevens
https://stardig.app/#sig-Ko2UH11WHQs.Progressive%20House'),
('♪ New World — Mikal
https://stardig.app/#sig-6NH6jafoeeo.Drum%20n%20Bass'),
('♪ Angelique Kidjo    We We — Angélique Kidjo
https://stardig.app/#sig-dEB-ID_3bfM.Garage%20House'),
('♪ Italo Dance Hits - Super Mix Vol. 1 - Various Artists — Various
https://stardig.app/#sig-daJNiQEXVCM.Euro%20House'),
('♪ Softest Place — D.K.
https://stardig.app/#sig-yPuMtyiswho.Leftfield'),
('♪ La Música Elegida — Julian Cardona
https://stardig.app/#sig-oSkNFn9ynUo.Progressive%20House'),
('♪ Untitled — Kevin Drumm & John Wiese
https://stardig.app/#sig-C6vlU_fzZHM.Noise'),
('♪ Bikini Wild — DJ Ekanta
https://stardig.app/#sig-_u2jAOisCa4.Psy-Trance'),
('♪ I Want You — La Strada
https://stardig.app/#sig-fowrI-KLO_o.Eurodance'),
('♪ The Finger’d Remove [Full Documentary] Jeph Jerman & Tim Barnes — Jeph Jerman & Tim Barnes
https://stardig.app/#sig-svNU3WCHgBs.Abstract'),
('♪ Sugar Mama — Thisha
https://stardig.app/#sig-b2TxaSs6bcU.Boogie'),
('♪ Love Of My Life (Extended Mix) — The Suspect
https://stardig.app/#sig-ZMRk1durpK0.Hands%20Up'),
('♪ Saving The Species — Montie The Bear
https://stardig.app/#sig-V_TES_o-jbE.Chillwave'),
('♪ Years Of Lead (Are Back Again) — Collapsing Scenery
https://stardig.app/#sig-SvCYGEsK1nM.Indie%20Rock'),
('♪ Kellerkind Altro Mondo Kruse&Nuernberg Remix — Various
https://stardig.app/#sig-66kTToCgYlU.Tech%20House'),
('♪ Je To Nejistý — J.A.R.
https://stardig.app/#sig-kCMbF4NM2hc.Europop'),
('♪ Neptune City — Death In Vegas
https://stardig.app/#sig-aVs_5OJ8Fck.Big%20Beat'),
('♪ You Keep Holding Back (Love Me) (Dubstramental) — Swing 52
https://stardig.app/#sig-Mf7nwZRHGdU.House'),
('♪ Angular Motion — Various
https://stardig.app/#sig-7zYz9CLAShU.Dub%20Techno'),
('♪ Do What You Want — Dr. Baker
https://stardig.app/#sig-z_zoLyZ15qk.Euro%20House'),
('♪ Persida — Smoley
https://stardig.app/#sig-G-ug6G0dsec.Deep%20Techno'),
('♪ What''s the matter — Trans Value Access
https://stardig.app/#sig-JeoVBicK1bQ.Avantgarde'),
('♪ Grasshopper — Adam X
https://stardig.app/#sig-u-tEA1iJ-0o.Industrial'),
('♪ Last Resort — Toni Halliday
https://stardig.app/#sig-Zb3MNIBGCC0.Synthwave'),
('♪ Love Remains — Kid Creole And The Coconuts
https://stardig.app/#sig-wM8M_AGyq3U.Disco'),
('♪ Filterfunk - S.O.S. (Message in a bottle) — Various
https://stardig.app/#sig-GZuDPONddPE.Euro%20House'),
('♪ Untitled — Baarek & Korüs & dantel
https://stardig.app/#sig-kFRNJTC0ncM.Freetekno'),
('♪ Rift — Tyler Mesa
https://stardig.app/#sig-9OGflAL8AWs.Progressive%20House'),
('♪ Don''t Believe the Hype (REMIX) — Boys Noize
https://stardig.app/#sig-Iy-uoDKndT8.Electro'),
('♪ Jump Hi (Todd Edwards Remix) — Lion Babe & Childish Gambino
https://stardig.app/#sig-IqSQDuMVKR0.Dance-pop'),
('♪ Pikant — Ash Ra Tempel
https://stardig.app/#sig-puDnZzUDx9g.Berlin-School'),
('♪ Wot (Stylus Plateau Stom Extended Mix) — Sweetbox & Jon
https://stardig.app/#sig-cB0V0jKDBL0.Euro%20House'),
('♪ Crowds — Printed At Bismarck''s Death
https://stardig.app/#sig-23YjcOV_qBg.Goth%20Rock'),
('♪ Our Day — Thorofon
https://stardig.app/#sig-0vs3-Xm5DUs.Dark%20Ambient'),
('♪ Now (Listen... Bass!) (Junkfood Junkies Mix) — Various
https://stardig.app/#sig-sW2H7RWlaTI.Gabber'),
('♪ Yeah — Hammon Decks
https://stardig.app/#sig-PDyQ6Pn3e4U.Leftfield'),
('♪ Hot On The Clue — New York Express & Mickey Denton
https://stardig.app/#sig-PEx5OPa5ndE.Boogie'),
('♪ Unique — Dolly Dots
https://stardig.app/#sig-yKAm_PXB5H8.Disco'),
('♪ Harmony Of Soul (David Ferrero Housepark Mix) — Electricano
https://stardig.app/#sig-Vlz7QPAtnVM.Progressive%20House'),
('♪ World Evolution — Various
https://stardig.app/#sig-U7RzKjenfoA.Techno'),
('♪ Hentai — Iceboy Ben
https://stardig.app/#sig-rPnGLPVohGc.Donk'),
('♪ Warfare (Hard NRG) - Piero Zeta & Manuel ES — Various
https://stardig.app/#sig-f0FvskRLKXM.Hardstyle'),
('♪ Ev of Isis _ Dark Ambition — Ēv Of Isis
https://stardig.app/#sig-onfb2Mc3ZNo.Industrial'),
('♪ Go Ahead London (Gloucester Avenue Mix) — Rapino Brothers Versus Trip Ship
https://stardig.app/#sig-V9CMVRNsQ_w.Euro%20House'),
('♪ The Same — Mortem & Mortem & Harland Piotr
https://stardig.app/#sig-JDsvfZTCTEs.Drum%20n%20Bass'),
('♪ Laffeyette — Various
https://stardig.app/#sig-vjF8Gk3nCxg.Broken%20Beat'),
('♪ Hardcore Orchestra — DJ Breeze & UFO
https://stardig.app/#sig-bGwAaJwDKho.Happy%20Hardcore'),
('♪ Let''s Get Down (Zodiac Dub) — Aquarius
https://stardig.app/#sig-NPH-T4spOyw.House'),
('♪ Break The Limits — Break The Limits
https://stardig.app/#sig-t8aflixG-DM.Breakbeat'),
('♪ Rails — Various
https://stardig.app/#sig-1zI0hnRKtEc.Deep%20House'),
('♪ Salvation — iSt3p
https://stardig.app/#sig-4rrzjyqcqyI.Dub'),
('♪ In/Tr06-05H — Evala
https://stardig.app/#sig-6Jrm7w8EnaE.Minimal'),
('♪ In Wearable Hertz — Leisure Muffin
https://stardig.app/#sig-BUTffZTXWuI.Techno'),
('♪ The Comet Is Coming (Drunkhertz Remix) — D-Devils
https://stardig.app/#sig-yGP9GSdIA7c.Hard%20Techno'),
('♪ Living For The Master  — The Amazing Manning Brothers
https://stardig.app/#sig-mgdWPCeIw0A.Boogie'),
('♪ Secret Weapon — Acid_Lab
https://stardig.app/#sig-Gd-h3xYgN48.Bass%20Music'),
('♪ Checkers — Magas
https://stardig.app/#sig-ovy-04ktz1I.Drone'),
('♪ Dancehall Queen — Various
https://stardig.app/#sig-Pf6SuXmxxfM.Reggae'),
('♪ Rendez-Vous — Pas De Deux
https://stardig.app/#sig-q3rH265tMic.New%20Wave'),
('♪ Shinowata (Original Mix) — Michael Jay Parker & Jan Miller
https://stardig.app/#sig-V9Il3gzAupg.Progressive%20Trance'),
('♪ Rainbow High In The Sky (Bounce Heaven Mix) — Bass Slammers & Sally Jaxx
https://stardig.app/#sig-9muz6jLiCfY.Donk'),
('♪ Follow Your Heart The DVRE Radio Remix — Ernest Kohl
https://stardig.app/#sig-2aXsshhzmmA.Hi%20NRG'),
('♪ Carrier Bag — Kid Carpet
https://stardig.app/#sig-m9OfAm5atN0.Lo-Fi'),
('♪ On The Moon — Galaxy
https://stardig.app/#sig-Sh3vhjObgm8.Dub'),
('♪ Desire (DJ Disciple Remix) — Minds Of Men
https://stardig.app/#sig-9Ca0pU70ZBo.Garage%20House'),
('♪ Sailing Past Midnight — Peter Baumann
https://stardig.app/#sig-i8UMORzK0VI.Krautrock'),
('♪ Let The Fire Burn — Visionized & Abstraqt
https://stardig.app/#sig-M00fWdcnFX0.Hardstyle'),
('♪ Valkyria (Original Mix) — Various
https://stardig.app/#sig--7zk9Calc6Y.Hard%20Trance'),
('♪ Plus 1 — M Series
https://stardig.app/#sig-7kXSVyRrXUo.Hard%20House'),
('♪ Remember (Instrumental Mix) — Fever Sound Records & Reve & Andy Broker & Farrel & Nina
https://stardig.app/#sig-j-zTjGZaL_w.Tech%20House'),
('♪ Coming Home II — Von Thronstahl
https://stardig.app/#sig-wMMRnA-vPLg.Modern%20Classical'),
('♪ Tu es l''amour de mes reves — Elvis Kemayo & K. System
https://stardig.app/#sig-hIuuCVMBQOI.Disco'),
('♪ Lokis Lament (Intelligent Audio IA2.3) EARTH EP — Trademark
https://stardig.app/#sig-t_z05Z4jEuI.Broken%20Beat'),
('♪ Up Next — Borren
https://stardig.app/#sig-d5Ul171C8WM.Breakbeat'),
('♪ Shut up and Dance(Space Cat Remix) [ALLDCD002] — Space Cat
https://stardig.app/#sig-sNqmwh2rzd4.Psy-Trance'),
('♪ Murder In Your Love — Psyche
https://stardig.app/#sig-oYoES1Uw6BY.Darkwave'),
('♪ What Goes Up Must Come Down (Extended Mix) — David Nimmo
https://stardig.app/#sig-rEw4Ye5IdcQ.Trance'),
('♪ Intruders (Gabber / Techno) — Sons Of Aliens
https://stardig.app/#sig-Y22pnbnf-5s.Gabber'),
('♪ Lost Cities — Coral Club
https://stardig.app/#sig-fWpp49xCAnM.New%20Age'),
('♪ CATCH ME I''M FALLING IN LOVE (VOCAL, INSTRUMENTAL MIX, REMIX, SPECIAL REMIX 1983) — Marsha Raven
https://stardig.app/#sig-Muwnyujxk64.Hi%20NRG'),
('♪ Faruk''s Funk — Various
https://stardig.app/#sig-mYNfLbW9NZ8.Latin'),
('♪ Johannesburg (Sonic Union Deep Tech Remix) — Jelly For The Babies
https://stardig.app/#sig-d5cYc-kzJoA.Progressive%20House'),
('♪ On Broadway — Frank Hatchett
https://stardig.app/#sig-h8KdPzFv_bU.Jazz-Funk'),
('♪ Utopia (Original Mix) — Slipstream
https://stardig.app/#sig--SbGyUL_rsE.Trance'),
('♪ Armchair (Analyst Special Edition Dub) [MOSAICLTDX2] — Bluetrain & Roger Gerressen
https://stardig.app/#sig-yhfFybVpfCQ.Dub%20Techno'),
('♪ Bad Luck — Various
https://stardig.app/#sig-QwgC-eQdRhU.Noise'),
('♪ Procera Paradox (Club Mix) — Syncom Data
https://stardig.app/#sig-UvaR5oOcBe8.Dub%20Techno'),
('♪ When The Night Is Right — Fragrance
https://stardig.app/#sig-gtBx7FRjHB8.Boogie'),
('♪ Calendar Girl [Brazil Version] — Tatjana
https://stardig.app/#sig-JDkqRbqZ3UA.Happy%20Hardcore'),
('♪ Digging Deeper — Groan-er
https://stardig.app/#sig-RYHv7Ob5uMs.Speedcore'),
('♪ Bermuda — Styro2000
https://stardig.app/#sig-0yThXxt08mk.Minimal'),
('♪ Under My Control — Quadzoid
https://stardig.app/#sig-Z69S3pThl98.Breakbeat'),
('♪ Version B ft. Sex Judas (SONNS Remix) — Tim Paris
https://stardig.app/#sig-LGTVR6hSPgo.Electro'),
('♪ A Long Journey (Original Mix) — Philler Music
https://stardig.app/#sig-v-vOTCKdeC0.Trance'),
('♪ Alexandria (Original Mix) — Stas Melys & Iversoon & Alex Daf
https://stardig.app/#sig-aoIKXdrYIzY.Trance'),
('♪ Chlo In The Rave — Various
https://stardig.app/#sig-FONcM8cg43U.Techno'),
('♪ The Prophet (DJ Uchikawa''s Bongo Dub) — DJD & Tom Silvester & Sportin Life
https://stardig.app/#sig-qfrogkUN_pY.Techno'),
('♪ Danger For Love (Vocal). Italo Disco 1986 — Deborah Haslam
https://stardig.app/#sig-6KkFM0ZVq_0.Italo-Disco'),
('♪ Bravo Hits Vol.05 — Various
https://stardig.app/#sig-ic07HOwXrxQ.Euro%20House'),
('♪ The First Step — Brain Laughter
https://stardig.app/#sig-LC1bppr2SW8.Ambient'),
('♪ The Chase — Mötel
https://stardig.app/#sig-cJ7cuG0twcc.Indie%20Pop'),
('♪ The Wipe (Dino Sabatini Version) — Teste
https://stardig.app/#sig-68cu0RDRn3M.Acid'),
('♪ Nebula — .g
https://stardig.app/#sig-A4Bn-gKRCl4.Deep%20House'),
('♪ Zuvuya - Grabbing Nandi By The Horn (This Ain’t Kansas Mix) — Various
https://stardig.app/#sig-s8VZx_rM8EI.Ambient'),
('♪ Bomb''oh (Clapham Common Out) — Mu.Ca
https://stardig.app/#sig--nRoA6eW-us.Italodance'),
('♪ Black Light — Ruttenbergs & E-Spectro
https://stardig.app/#sig-9Wv7KVDwV-M.Tech%20House'),
('♪ Lose Control - Descontrolate — Yohany
https://stardig.app/#sig-TJHuHHaqP8o.Dance-pop'),
('♪ My Baby Just Cares For Me — Trans Talk
https://stardig.app/#sig-d1g3eup1Ni4.Eurodance'),
('♪ Esclavitud Animal — Carlos Ann
https://stardig.app/#sig-RdyrXZrqb58.Makina'),
('♪ Easy Pick Up — Merry Crisis
https://stardig.app/#sig-upVeAtIj9fE.Rhythmic%20Noise'),
('♪ Lucy Said (Landslide Remix) — Fenomenon
https://stardig.app/#sig-0sVPlWx9MmQ.Future%20Jazz'),
('♪ Breathe — The Wee DJs
https://stardig.app/#sig-N7KxQ-AEC50.Electro'),
('♪ Step In — Roland Schwarz
https://stardig.app/#sig-QJ6kFSruIbc.Future%20Jazz'),
('♪ How Loud Is Your Love — Shades of Thunder & Jan Johnston
https://stardig.app/#sig-zZBO77UCAdI.Synthwave'),
('♪ SFX NASA 1 tvfx02 — SFX
https://stardig.app/#sig-QJ2QW1pKJcU.Hip%20Hop'),
('♪ Baka Monkey Doll — Alexanders Dark Band
https://stardig.app/#sig-tC8fH-YtcLo.Trip%20Hop'),
('♪ Staub 007 A2 — Various
https://stardig.app/#sig-rPHxPYAphpc.Ambient'),
('♪ Ridem Life — Dyno
https://stardig.app/#sig-PAXYMEGlXPA.Hard%20Trance'),
('♪ I Can Do It (I Can Dub It) — Denise Gordon
https://stardig.app/#sig-3jcwnigpcgY.Speed%20Garage'),
('♪ Oni No Men — Lars Klein
https://stardig.app/#sig-345o4hTVGEs.Techno'),
('♪ That`s the way my heart goes Voice 2006 — Marie Serneholt
https://stardig.app/#sig-HD3GGCZmzT8.Europop'),
('♪ Live J.M.F — Jean-Marc F
https://stardig.app/#sig-B-7_SKn7iNA.Freetekno'),
('♪ Bush Workout — King Britt & Oba Funke
https://stardig.app/#sig-cZcS_MQdaeE.Future%20Jazz'),
('♪ I Got Cha Opin (Rare Lazer Scope Remix) — Black Moon
https://stardig.app/#sig-ptgTO6mBNL8.House'),
('♪ Keleh (River Yarra''s Situationist Rework) — River Yarra & Ausecuma Beats
https://stardig.app/#sig-qyv4hIv7RFo.Funk'),
('♪ Eastern Soul (Yukihiro Fukutomi Remix) — Nu Tropic
https://stardig.app/#sig-b8vRAKgJovo.Broken%20Beat'),
('♪ Softly The Morning Comes — Hale And Haines
https://stardig.app/#sig-nRFsEuRqiSQ.Berlin-School'),
('♪ Tenebreuse Musique 04 - Kan10 + Fungi + Frixion Fanatic + Nyor : Dans L''Autre Monde — Various
https://stardig.app/#sig-VdQHob2WPSI.Freetekno'),
('♪ Aundrea (흑장미) — 밴드 88 & 밴드 88
https://stardig.app/#sig-tXuhK8iMQ-U.Jumpstyle'),
('♪ Bangkox 2555 — Gido
https://stardig.app/#sig-bt9YvEVPg7k.Psy-Trance'),
('♪ Elton John ~ Bennie & The Jets 1973 Soul Purrfection Version — Various
https://stardig.app/#sig-fpBWs9xi0As.Pop%20Rock'),
('♪ Mandy - A.  I Just Can''t Wait (Mickey Finn On The Mix) Drum And Bass Mix (1992) 🇬🇧 — Mandy Smith
https://stardig.app/#sig-9nMmjjvdPso.Euro%20House'),
('♪ TAMAYODO - Teaser (Rustblade) — Merzbow
https://stardig.app/#sig-q2dJ6gh-sks.Rhythmic%20Noise'),
('♪ Easter Bunny Hop — Evelyne John
https://stardig.app/#sig-S-MoXJ4X8Bg.Funk'),
('♪ Pull Up (VIP) (Instrumental) — Unknown Artist
https://stardig.app/#sig-2Ux9ki441Zs.Dubstep'),
('♪ Take The Time — Lia Marquis
https://stardig.app/#sig-Fl1xJ_Xw3bc.Freestyle'),
('♪ Goodbye, Hello — Various
https://stardig.app/#sig-feqEKwYrSOo.Vocal'),
('♪ The Blog ( Cocoon Mix ) — Sound To Light
https://stardig.app/#sig-a3Laig0B7FU.Techno'),
('♪ V2 05 — We Will Fail
https://stardig.app/#sig-wTZszHGA_V4.Experimental'),
('♪ 11 — Masami Akita
https://stardig.app/#sig-fDx8LX6vX3c.Leftfield'),
('♪ (Please Come) Back To Me — Juan Carlos Lopez Telleria
https://stardig.app/#sig-2xB06CuphHs.Hi%20NRG'),
('♪ Suprabomb — Obtane & Fris
https://stardig.app/#sig-ZrDAuaew_Is.Drone'),
('♪ Nothing Happens Before 2am (Explicit Mix) — Ben Gomori
https://stardig.app/#sig-gao1bHKy0b8.House'),
('♪ Piece Of Me (International Version) — Britney Spears
https://stardig.app/#sig-b7t8l_lm-SI.Euro%20House'),
('♪ Love Is Sick! — Yuko&Domesticks
https://stardig.app/#sig-WqVvd7spReQ.Synth-pop'),
('♪ It Gazes Also Into You — Remanence
https://stardig.app/#sig-4rxxExy4Fu4.Ambient'),
('♪ Original Badboy — Various
https://stardig.app/#sig-g6d5NBQs7JE.Drum%20n%20Bass'),
('♪ Apollo(Live on your TV) (Official Music Video) — Apoptygma Berzerk
https://stardig.app/#sig-Hy0cP7SlDEM.Alternative%20Rock'),
('♪ Shades Of Rhythm — Shades Of Rhythm
https://stardig.app/#sig-Tec5ZdWkIyU.Acid%20House'),
('♪ Jolie Sarah — Voilaaa
https://stardig.app/#sig-F-PWntPbdKw.Disco'),
('♪ Miłość To Wiatr — D''Adekoya
https://stardig.app/#sig-nsBShvu9kaE.Eurodance'),
('♪ Docomo — Various
https://stardig.app/#sig-QjxAzzqUQLM.Post%20Rock'),
('♪ Farben — Lucilectric
https://stardig.app/#sig-xarju4Jvwkw.Euro%20House'),
('♪ méduse - Lukas Rabe — Various
https://stardig.app/#sig-XMALymL39uk.Dub%20Techno'),
('♪ Passage — Solar Fields
https://stardig.app/#sig-64G9LOzk7qk.Downtempo'),
('♪ World Is A Fuck Vol.1 [Full album] — Various
https://stardig.app/#sig-MdTT0j9jarM.Breakcore'),
('♪ Psychoanalysis — Cliche Morph
https://stardig.app/#sig-BewOL3RflDI.Techno'),
('♪ Souls On Fire — Tracie Young
https://stardig.app/#sig-BpE7tzPVezU.Pop%20Rock'),
('♪ Hal 2010 — Thomas Brinkmann
https://stardig.app/#sig-alzxVtnnF2A.Deep%20House'),
('♪ Time To Change — Ape
https://stardig.app/#sig-fmz9G1GbRCM.Italo-Disco'),
('♪ Daydreamer — Koxbox
https://stardig.app/#sig-P_6NIvy7EeY.Psy-Trance'),
('♪ Normon — Various
https://stardig.app/#sig-Q7fssK3E5Eg.House'),
('♪ Little Mildness — K-Led & Bybo
https://stardig.app/#sig-Lwvi3yydZ8I.Tech%20House'),
('♪ XX.1 (B2) [MOL XX1] — Inigo Kennedy
https://stardig.app/#sig-PeFwACY_Cx4.Techno'),
('♪ Doina — Various
https://stardig.app/#sig-eOZ6WEyKzWU.Minimal%20Techno'),
('♪ Her Eyes, Her Lips — Mateo
https://stardig.app/#sig-LU6MdiNrabo.Downtempo'),
('♪ Wasting Time — Various
https://stardig.app/#sig-KxVKLL_Uirs.Minimal'),
('♪ Spiritual Tekno — Araako
https://stardig.app/#sig-FrL3QKaMUCM.Hard%20Techno'),
('♪ HB Monte & Lumidee - Luv Ya Better (Official Music Video) (HQ) (HD) — H. B. Monte & Lumidee
https://stardig.app/#sig-AhvV76wO5Yc.House'),
('♪ PRINCESS CENTURY- Sunrise 101/Last Disco — Princess Century
https://stardig.app/#sig-Mp7rM8jtAYY.Indie%20Pop'),
('♪ PI Chillwave Grooves IV  *2018* — Various
https://stardig.app/#sig-AlW8MCF_NGQ.Chillwave'),
('♪ Disillusion (directed by Garth Jennings) — Badly Drawn Boy
https://stardig.app/#sig-B11msns6wPU.Leftfield'),
('♪ Hey Fonzo !! (That Right) — Mito
https://stardig.app/#sig-9A4_2kNI23I.Italo-Disco'),
('♪ Talven henki / Winter Spirit — Ø
https://stardig.app/#sig-K02txUE2wcM.Ambient'),
('♪ Bizarre Sunrise — DJ Stevo
https://stardig.app/#sig-LC1s9QUVXF0.Goa%20Trance'),
('♪ Shiva — Masa
https://stardig.app/#sig-UE0Gz-jTLvg.Goa%20Trance'),
('♪ The Alessandroni Effect — Triax
https://stardig.app/#sig-0Wfy8O_CyvU.Abstract'),
('♪ Infection (E-sassin Remix) — Various
https://stardig.app/#sig-j_9QyxB4mcs.Drum%20n%20Bass'),
('♪ Vari-Speed — Panacea
https://stardig.app/#sig-bNWq_0AQrnc.Drum%20n%20Bass'),
('♪ johnny loopz & rudy rude dog gonzalez - think u big time — Various
https://stardig.app/#sig-n28aofOaY4c.Hard%20House'),
('♪ Spinning Mobile — Various
https://stardig.app/#sig-UipEc049tUM.Electro'),
('♪ The Dead Sea — Lapalux
https://stardig.app/#sig-85pdYM3Q_-M.Instrumental'),
('♪ Who Stole The Soul - (Unexpected Mix) — DJ Linus
https://stardig.app/#sig-2-FnnPfvrzM.Tech%20House'),
('♪ Mindblock And Arrest — Various
https://stardig.app/#sig-nyjpEET2LCk.Goa%20Trance'),
('♪ Lonnie Gordon "It''s Not Over" (Tech No Dub) 1989 — Lonnie Gordon
https://stardig.app/#sig-gYrMsxyK5P8.Disco'),
('♪ Falling Down (Auden Remix) — Alan Fitzpatrick
https://stardig.app/#sig-z9UEDElN9AU.Dubstep'),
('♪ Sex (Original Mix) — Disco Monkey
https://stardig.app/#sig-4-FcIMyHiNw.Progressive%20Trance'),
('♪ Twisted Mothafucka — The M.O.L.E.
https://stardig.app/#sig-pj65hTonbxE.Hardstyle'),
('♪ Wake Up (Joey''s Delirious Dub) — Spin That Wheel
https://stardig.app/#sig-hzcdEITKozM.Garage%20House'),
('♪ Psalm — Steintryggur
https://stardig.app/#sig-mWIgP1zldJQ.Post%20Rock'),
('♪ Svētki — Favorīts & Aivis Štrāls
https://stardig.app/#sig-x8oSsd-ZMtE.Europop'),
('♪ Transmission 7 — Samuel Kerridge & Taylor Burch
https://stardig.app/#sig-hwS689I_NXk.Techno'),
('♪ Up and Running — Keith Mansfield
https://stardig.app/#sig-bnSiwdXhvxE.Ambient'),
('♪ Meant To Be (Extended Mix) — Tritonal & RKTKT
https://stardig.app/#sig-AhQ7eyk8gLk.Progressive%20House'),
('♪ Hard Dimension (Hardcoreman Remix) — Hardcoreman
https://stardig.app/#sig-tSaVelkhtwQ.Hardcore'),
('♪ The Bleep-F.Me (Technoline Recall) — Various
https://stardig.app/#sig-9w3PV_Vvs8s.Techno'),
('♪ Love Gives Wings (With Wings) — Ruth White
https://stardig.app/#sig-7q_CJtAOscU.Experimental'),
('♪ The Palace — David Arkenstone
https://stardig.app/#sig-jgvFhXe4WCQ.New%20Age'),
('♪ Bigga Times — Darqwan & Mark One
https://stardig.app/#sig-4BKWHLfuQRc.Dubstep'),
('♪ Exploring Deep Inside — Radio Movie
https://stardig.app/#sig-opCY4yXGgwk.Italo-Disco'),
('♪ The Letter — Deux Filles
https://stardig.app/#sig-smKlCeYbi8M.New%20Wave'),
('♪ What I Mean (SWEATSON KLANK remix) — Cults
https://stardig.app/#sig-R9rLVdip0NM.Dance-pop'),
('♪ Onward — KryoYmir
https://stardig.app/#sig-ygXRVNIcKzo.Dance-pop'),
('♪ diskob46 - recap — Cai Bojsen-Møller
https://stardig.app/#sig-V_4llype7VU.Electro'),
('♪ Work 2 Doo (Bates Motel Mix) — Roach Motel
https://stardig.app/#sig-PnKub7ZJiuY.House'),
('♪ Without Love — Peter Brown
https://stardig.app/#sig-jIBrbjYJA6s.Soul'),
('♪ Control — Snog
https://stardig.app/#sig-MJwwfIq_HXk.EBM'),
('♪ Vessojen Mies — Tähtiportti
https://stardig.app/#sig-VckqBZSI5fU.Ambient'),
('♪ You Deserve A Break Today — Kool & The Gang
https://stardig.app/#sig-TGm3mzoe9C8.Soul'),
('♪ She Calls — L''Avenir
https://stardig.app/#sig-ydBtLWpV2aE.Synthwave'),
('♪ Flaws — Gaspar & Rayven
https://stardig.app/#sig-MgY5X2Csl6w.Progressive%20House'),
('♪ Beyond My Power (Official Preview) — Omegatypez
https://stardig.app/#sig-YqX7pfh6zbA.Hardstyle'),
('♪ Einstürzende Neubauten ‎– "Live In Kunstkopfstereo" (Eisengrau ‎C-46) 1980 — Einstürzende Neubauten
https://stardig.app/#sig-6LaoJ1TXcqs.Industrial'),
('♪ Musik Is Musik (Polfrey Hardfloor Edit) — DA80
https://stardig.app/#sig-5ZLsGeXduqM.Acid%20House'),
('♪ Naughty Spot — PET Duo
https://stardig.app/#sig-boqp2Nkpfis.Hard%20Techno'),
('♪ Origin Unknown — Various
https://stardig.app/#sig-mskPUf3AC08.Soundtrack'),
('♪ Jackie Jackie [Dyylan''s Subzero Nocturne] — Sally Shapiro
https://stardig.app/#sig-A4l4H2ueGBg.Indie%20Pop'),
('♪ S Tone Inc  ‎– Ainda Sonhar (Club Edit)(1997) — S-Tone Inc.
https://stardig.app/#sig-ACl8K_2w8Mo.Trip%20Hop'),
('♪ sukima — Morimoto Naoki
https://stardig.app/#sig-zvodTuKRS2U.Ambient'),
('♪ Une Fille Nommée Désir — Visiteurs Modèles
https://stardig.app/#sig-0y8wT-9hpRI.Disco'),
('♪ Disco Theme — Backdoor Band
https://stardig.app/#sig-vvGnDET39nw.Vocal'),
('♪ Clogged Airways — The Busy Signals
https://stardig.app/#sig-U0WN1FR7EUo.Lo-Fi'),
('♪ Deep Right Now! — West Coast Swingaz
https://stardig.app/#sig-7GdBNJwcUQA.Garage%20House'),
('♪ You''re Just Using Me For Sex — Huge Voodoo
https://stardig.app/#sig-ybYUbY-n7hg.Leftfield'),
('♪ I Apologize — Misantrophe
https://stardig.app/#sig-o06SdLsPIeQ.Goth%20Rock'),
('♪ Girl — Various
https://stardig.app/#sig-aql2ZoAfGv0.Future%20Jazz'),
('♪ Nia Pebbles - Trouble (Prime Cuts Version) — Various
https://stardig.app/#sig-fuL7KX3hUTY.Europop'),
('♪ Magic Dancer — Tamara Lorincz
https://stardig.app/#sig-Mk0GJE04xco.Disco'),
('♪ Destiny [German New-Wave Demo - 1984] — Insanity
https://stardig.app/#sig-p65N8RKZeqU.Goth%20Rock'),
('♪ Sound-Line - Volume 7 (1998) — Various
https://stardig.app/#sig-Z_hIxH0wNBk.EBM'),
('♪ Radiate — A Ritual Sea
https://stardig.app/#sig-f2TRFdhkUek.Coldwave'),
('♪ My Drunk Foot — Afternoon Coffee Boys
https://stardig.app/#sig-o-PDZBbRmFs.Minimal'),
('♪ Unforgettable (Geo DJ vs F.E.D.O. Radio) (Freaks Jam Vs Dj Geo) — Freaks Jam & DJ Geo
https://stardig.app/#sig-vwYzj9EPAVw.House'),
('♪ "YUME NO GŪZEN" | Official Audio Sampler — Nuts Star
https://stardig.app/#sig-WgwBnBiJ-70.Industrial'),
('♪ Fragile Storms From Below — Raffaele Serra
https://stardig.app/#sig-ppvj7lPH8Mg.Ambient'),
('♪ Latinhouse — Zoe
https://stardig.app/#sig-Vlc1NnPUk9g.Italo-Disco'),
('♪ Times (Alternative Mix) — Developement In Conquest
https://stardig.app/#sig-Xb7T0nfyUl0.Italodance'),
('♪ Umbrella — Maria Sadowska
https://stardig.app/#sig-B9vC40axYRU.Jazz-Funk'),
('♪ A Visible Length Of Light — Lea Bertucci
https://stardig.app/#sig-Yg0oSMehmPc.Field%20Recording'),
('♪ Deep Cut (Extended Mix) — Go Freek
https://stardig.app/#sig-1GAGCNE9Vio.Electro%20House'),
('♪ The Love Of A Child — Slizzy Bob
https://stardig.app/#sig-sbnQRC0W7Q4.Disco'),
('♪ Deep in You (Ortegàs Soulful Dub Mix) — Various
https://stardig.app/#sig-Rx-9WEFMnok.Hard%20House'),
('♪ Blooms Eventually — Pulseprogramming
https://stardig.app/#sig-861mlQohPmk.Abstract'),
('♪ These Are The Times (Vission & Lorimer Stereophonic Mix) — Pure Sugar
https://stardig.app/#sig-BdY0ohSY7Lo.House'),
('♪ Shut Up Get Up — Various
https://stardig.app/#sig-qd-GwqJmUm4.Hardcore'),
('♪ Kolyskova  — Various
https://stardig.app/#sig-djycdI5jeko.Psy-Trance'),
('♪ Lay Here — Elektrochemie LK
https://stardig.app/#sig-9mTuj8EauEs.House'),
('♪ Tokyo Rose - Idle Eyes — Idle Eyes
https://stardig.app/#sig-fUx_fMAGvMg.Disco'),
('♪ Under Over The Clouds (Luke Abbott Remix) — Micromattic
https://stardig.app/#sig-Umkr8xDnwjc.Glitch'),
('♪ Echolot — Anakoluth
https://stardig.app/#sig-mrLJkV4waas.Goa%20Trance'),
('♪ Free Musik Download: Relaxing Instrumental Musik zum Träumen Teil 2 — Dreamweaver
https://stardig.app/#sig-A5C7SD2Skr4.Chillwave'),
('♪ Further Afield — Alex Albrecht & Melquíades
https://stardig.app/#sig-7JWinaA1xsI.Nu-Disco'),
('♪ SF — John Kaizan Neptune
https://stardig.app/#sig-wrsDreuKfL4.Jazz-Funk'),
('♪ Lost Control — D_iolax
https://stardig.app/#sig-JWXAe572LjM.Drum%20n%20Bass'),
('♪ Nomor — Warzou
https://stardig.app/#sig-H-VJB5koPAo.Tribal'),
('♪ Latex Ou La Vie ? (Orgasmix) — C. Fab !
https://stardig.app/#sig-j6qsyiJ8C5w.Hardcore'),
('♪ One Last Kiss - SOLITARIO latin freestyle — Julie
https://stardig.app/#sig-5iyB-EPUfOg.Freestyle'),
('♪ Anything''s Better — Various
https://stardig.app/#sig-bbVvhnbZhpU.Drone'),
('♪ Movement — Hollen
https://stardig.app/#sig-lXKmu3P-yH8.Tech%20House'),
('♪ Untitled — Krank & DJ Wicked
https://stardig.app/#sig-8UUcKmw_cAw.Hardcore'),
('♪ Intensity — Circle Confusion
https://stardig.app/#sig-stht8U-RNPQ.Coldwave'),
('♪ Me Everytime — Mox Jet
https://stardig.app/#sig-462ebCpzSFg.Post-Punk'),
('♪ Come With Me (It''s Alright) (Trime''n Delgado Club Mix) — Indee
https://stardig.app/#sig-6kZMt9PmH2Y.Euro%20House'),
('♪ Risingson — Massive Attack
https://stardig.app/#sig-WXQnrJg69pA.Downtempo'),
('♪ Messing Around (2 Step Mix) — Once Waz Nice
https://stardig.app/#sig-p7Onz0n4P28.UK%20Garage'),
('♪ B͟omba E͟stéreo - D͟eja  (Full Album) 2021 — Bomba Estéreo
https://stardig.app/#sig-9J-H2Wjki4Y.Dance-pop'),
('♪ Majestic Header (Celebrate Psi Phenomenon - 2006 - Drone/Experimental) — Kneale.Kneale.Kneale
https://stardig.app/#sig-95ULoQxIYMU.Drone'),
('♪ Blackmachine — Deadlock
https://stardig.app/#sig-ay22A5hdovk.Speedcore'),
('♪ Big Ass Booty (Jump Again Mix) — Westside & George Centeno & Techni-KL & AMbassador
https://stardig.app/#sig-8no9hudA0O0.Jumpstyle'),
('♪ Do It Again — Controlled Substance
https://stardig.app/#sig-VwwiYPENIag.Drum%20n%20Bass'),
('♪ Cuica — Emancipator & 9 Theory
https://stardig.app/#sig-BK6RM3vQtlo.Downtempo'),
('♪ Real Subjects — Adultnapper
https://stardig.app/#sig-ZqtVk8Dt_H0.Minimal'),
('♪ I Human — Various
https://stardig.app/#sig-A_FH3oGq5Pw.Minimal'),
('♪ Low Land — Men 2nd
https://stardig.app/#sig-J4kQDgnF9Fk.EBM'),
('♪ My Atmosphere — Brian Van Dalen
https://stardig.app/#sig-LHIDfR7b_Ok.Breaks'),
('♪ Tales Of Hardstyle — t+pazolite
https://stardig.app/#sig-or048PPb1jo.Happy%20Hardcore'),
('♪ Tear It (End) — Varg
https://stardig.app/#sig-E7nd0-G20c8.Drone'),
('♪ Meta Dimension — Various
https://stardig.app/#sig-BqgNrsF9EI0.Hi%20NRG'),
('♪ Wave Force — Daywalker + CF
https://stardig.app/#sig-8_fiMnnKbAU.Industrial'),
('♪ Bayta — Bmbmnd & Simone Bauer
https://stardig.app/#sig-XFK5og5eiWI.Deep%20Techno'),
('♪ The Square Triangle — Synthetic Block
https://stardig.app/#sig-FQc6k6bERpY.Berlin-School'),
('♪ Foggydays Bim&Bianca — Bim & Bianca
https://stardig.app/#sig-bNeV_rQufS8.Acid%20Jazz'),
('♪ Double Starshine — Siceron
https://stardig.app/#sig-18CWFVsrU1U.Progressive%20House'),
('♪ Interval Two — Autumn Of Communion
https://stardig.app/#sig-PxSep0DfAW8.IDM'),
('♪ portal preview — Artman
https://stardig.app/#sig-9YcjKe-iL7Y.Balearic'),
('♪ 4X Harder Vol.3 — Various
https://stardig.app/#sig-Bc6GY7Fr4-Q.Hard%20House'),
('♪ Untitled — Freddy Fresh
https://stardig.app/#sig-t-w-VfjrIjw.Acid'),
('♪ Technological — Twelve Sessions & Technology
https://stardig.app/#sig-JIvdpWs-YdI.Psy-Trance'),
('♪ Disuelvanse — Swim
https://stardig.app/#sig-ZRl1nqs8jW4.Makina'),
('♪ TRASH OR TREASURE REMIXED (TEASER) — Kerbside Collection
https://stardig.app/#sig-DRVLcZpXDcI.Soul'),
('♪ Move Your Love (Inspiration Vibes Extended Mix) — Double Nation
https://stardig.app/#sig-9QMgLpQA8-4.Progressive%20Trance'),
('♪ Sound Of Victory (Non Vocal Mix) — Mario Ranieri
https://stardig.app/#sig-AAK5-ytGUVQ.Hard%20Techno'),
('♪ Ballet Subacuático — Salón Dada
https://stardig.app/#sig-1133KrRFKSs.Synth-pop'),
('♪ L''obus Rouillé, Trouvé Dans La Dune — François Bréant
https://stardig.app/#sig-v2ZAULC475k.Ambient'),
('♪ Dual Side — Dual Logic
https://stardig.app/#sig-SiP-3zhbAr4.Psy-Trance'),
('♪ Double Dee Featuring Dany - Found love (1990 House version) — Various
https://stardig.app/#sig-1DMKF4FRWpE.Trance'),
('♪ Film Grain — Disco Nihilist
https://stardig.app/#sig-pF8tyUrwReU.Deep%20House'),
('♪ Break Pressure — Alex Coulton
https://stardig.app/#sig-46Xk5TyHOIo.Dubstep'),
('♪ Ambiguity — In Flagranti
https://stardig.app/#sig-S_Qm8oKWqjE.Disco'),
('♪ Shotgun — Various
https://stardig.app/#sig-bRfS1Nc6fnk.Disco'),
('♪ Monestary — Data-Bank-A
https://stardig.app/#sig-3O9dkoebsyw.Industrial'),
('♪ All the Colors of the Dark — KЯUR
https://stardig.app/#sig-9M5iS0LaDbc.Coldwave'),
('♪ Everything Will Be Alright (Club Mix) — Kate Ceberano
https://stardig.app/#sig-KJxY_sPvjug.Synth-pop'),
('♪ It Isn''t Changed (Longdrink Remix) — Michael Maltese
https://stardig.app/#sig-gI8Cenncfn0.Euro%20House'),
('♪ Jack''n Chill - The Jack That House Built — Jack ''N'' Chill
https://stardig.app/#sig--PJAWvZ8tgw.Synth-pop'),
('♪ Saint Preserve Us — Piano Magic
https://stardig.app/#sig-E2iU9KLjQb4.Indie%20Rock'),
('♪ Breath (Dub Mix) — Claudia Cazacu
https://stardig.app/#sig-aP7Omlk_FZ0.Trance'),
('♪ Sky Hi — Man With No Name
https://stardig.app/#sig-vAbueW3RCkw.Acid'),
('♪ Simply Red - Money''s Too Tight To Mention (Extended Mix v2.0) — Various
https://stardig.app/#sig-0mCtMv2Dfjw.Synth-pop'),
('♪ Intermission — Snowdream
https://stardig.app/#sig-21jbKziwCpU.Vaporwave'),
('♪ Basement Freaks - Super Spanish Combo /// Ritmo Callejero (Rmx) — Super Spanish Combo
https://stardig.app/#sig-zPD_58Ji8ag.Bass%20Music'),
('♪ Kärlekens Hav — Fia Nyström
https://stardig.app/#sig-Doy3FT0thZU.Pop%20Rock'),
('♪ U.F.O. A Go - Go — Angie Reed
https://stardig.app/#sig-l-kkHJIFU2o.Electro'),
('♪ Alive — MakeFlame
https://stardig.app/#sig-v4Uw8Ds81sM.Trance'),
('♪ Hold On — Various
https://stardig.app/#sig-LdocZX8u__c.RnB%2FSwing'),
('♪ The Creation — Chillie Moe
https://stardig.app/#sig-8bSYWwXhs4Y.Hip-House'),
('♪ You''re So Romantic — Sheryl Lee Ralph
https://stardig.app/#sig-o2vw42OWUZg.Hi%20NRG'),
('♪ BPMF''s Stupid Ambient Interlude — Rancho Relaxo Allstars
https://stardig.app/#sig-MgK6Zts3UzU.Acid%20House'),
('♪ Avarija Valley Rect — Various
https://stardig.app/#sig-wMXxrYuvpqY.Electro'),
('♪ 88.3 feat.  Lisa May - Wishing On A Star (Rogue Unit Full Mix) — 88.3 & Lisa May
https://stardig.app/#sig-Zi_PtC7VRS4.Acid'),
('♪ Mustang Sally (Qdup Remix) — The Darrow Chem Syndicate & Silver Apples
https://stardig.app/#sig-_ijoKqEwtC4.Breaks'),
('♪ Shoulder Roller (Autobots Remix) — D''State & Darkus & Tension
https://stardig.app/#sig-9MVB1wX95nI.Breaks'),
('♪ Рагга — Green Grey
https://stardig.app/#sig-VDcumhsbx_0.Alternative%20Rock'),
('♪ Pulling on a Line — Kent Sparling
https://stardig.app/#sig-hx-2uRZaCw4.Abstract'),
('♪ Radio Dreamscape Volume One Happy Hardcore Compiled By DJ Seduction 1995 — Various
https://stardig.app/#sig-FZA_z1Bmp0U.Happy%20Hardcore'),
('♪ Alors On Danse — Stromae
https://stardig.app/#sig-syedGDO3qaM.Hip%20Hop'),
('♪ Trouble Maka — Stranjah
https://stardig.app/#sig-n4Av3fJYe-A.Drum%20n%20Bass'),
('♪ She Turns (Markus Schulz Remix) — Departure
https://stardig.app/#sig-RNQS1ys0Y7w.Progressive%20Trance'),
('♪ (1999) Aquarian Dream - Love And Tears [The Soul Creatures Reworked Live Dub RMX] — Aquarian Dream
https://stardig.app/#sig-84HIelNoPcc.House'),
('♪ Yagga-Yo — Megaman & Beenie Man
https://stardig.app/#sig-JTJfRbgNCwk.UK%20Garage'),
('♪ Flight Into BA — Kate Simko
https://stardig.app/#sig-np7FG58k0Yk.Minimal'),
('♪ Solitary H — Citizens Above Suspicion
https://stardig.app/#sig-9NSFQx88734.Minimal%20Techno'),
('♪ Something Inside - Mari Kvien Brunvoll (Marco Faraone feat. Piegaja remix) — Mari Kvien Brunvoll
https://stardig.app/#sig-4Q5C1Tf-oew.Tech%20House'),
('♪ Studio Ibiza — Various
https://stardig.app/#sig-FxqW06njdIY.Electro'),
('♪ Carnevale Fla Fla — Nux Vomica
https://stardig.app/#sig-alMBGWgNZYA.Jungle'),
('♪ Babylon (Dillinja Remix) — Splash
https://stardig.app/#sig--slzgjFyd-s.Drum%20n%20Bass'),
('♪ Aleta — Maggotron
https://stardig.app/#sig-Ko6XRhWzYw0.Bass%20Music'),
('♪ The Room 8 Record Bag: Rui  Murka - Amigos (Tiago Remix) — Rui Murka & Mr. Lizard
https://stardig.app/#sig-f0hfxtG-DrY.Downtempo'),
('♪ Alien Galaxy Builder - Full Side C - Light Sounds Dark records — Various
https://stardig.app/#sig-x0GB4gdPZw4.Dark%20Ambient'),
('♪ The Reality And The Future — DJ Yoeri
https://stardig.app/#sig-xKooOLl-Ldg.Hard%20House'),
('♪ Backup The Future — ExploSpirit
https://stardig.app/#sig-DQKaT-nhOfA.Techno'),
('♪ 3 Turntables (Chiller Productions Pumpin Remix) — 12 Inch Thumpers
https://stardig.app/#sig-2hlxvF64IZE.Hard%20House'),
('♪ Frontside — Further Individual Control
https://stardig.app/#sig-ItM_VIDupOY.Acid'),
('♪ Fly With Me — Kayou.
https://stardig.app/#sig-0k7pUXLmIHU.Indie%20Pop'),
('♪ 21st Century Neophyte Remix — DJ Rob & MC Joe
https://stardig.app/#sig-_FZdHT8PN-E.Gabber'),
('♪ Coda (Lee Coombs Remix) — Sunscreem
https://stardig.app/#sig-Dc8cMGYBQTk.Breaks'),
('♪ Rainy Blue ✨ 徳永英明 — Hideaki Tokunaga & Hideaki Tokunaga
https://stardig.app/#sig-Giy-8smnSew.Vocal'),
('♪ Moses Jam — Josh Humphris
https://stardig.app/#sig-5hN_6qE8QaM.Chillwave'),
('♪ Fertilize — Miss Universum
https://stardig.app/#sig-d_2ASG2PAMw.Synth-pop'),
('♪ Loner — Current Value
https://stardig.app/#sig-pFe2NIQLSK0.Drum%20n%20Bass'),
('♪ Untitled — Blaze
https://stardig.app/#sig-hfxniuh1pNM.UK%20Garage'),
('♪ Soft Image — Various
https://stardig.app/#sig-ExPw320FhiU.Dub%20Techno'),
('♪ The Treacherous 3   bum bum bum bum — Treacherous Three & Freddy Fresh
https://stardig.app/#sig-lOF5ZF0TBBg.Big%20Beat'),
('♪ I Love You — Sabrina Salerno
https://stardig.app/#sig-QKwR3YQdaTs.Italodance'),
('♪ 7 zile, 7 nopti — Various
https://stardig.app/#sig-Q4LapsuZenY.Europop'),
('♪ MAJOR LEE VICENTE  let me take your higer — Major Lee Vincente
https://stardig.app/#sig-h4zn9gsHWe8.Funk'),
('♪ Flash Memory — High-Functioning Flesh
https://stardig.app/#sig-k24JfC50FPU.EBM'),
('♪ Звездочка — Луна
https://stardig.app/#sig-FkC3ECCD6e0.Indie%20Pop'),
('♪ Barcelone — La Stele Des Pleurs
https://stardig.app/#sig-AbIcjnpJlDI.Synthwave'),
('♪ Black Jack (Vocal) — Uppercut
https://stardig.app/#sig-BAAixezHqMU.Italo-Disco'),
('♪ Waterland — Abyss
https://stardig.app/#sig-hrlhkF-mtVo.Psy-Trance'),
('♪ Fruend — Braids
https://stardig.app/#sig-726T6mylEZU.Indie%20Rock'),
('♪ Everlasting Dreams (Single Version) — Kenkou
https://stardig.app/#sig-NwbKBa6wV2o.Future%20Jazz'),
('♪ Twisted Club 69 Re-Styled — Club 69
https://stardig.app/#sig-qp4UP5oDvfk.Tribal%20House'),
('♪ Hardrum (Drum Beat) — The Dolphins
https://stardig.app/#sig-mcnoJ2RIBrk.Progressive%20Trance'),
('♪ Hit Me — Bad Pimps
https://stardig.app/#sig-b9eEgCHQiZQ.Techno'),
('♪ Schranzdata - Anettqua — P.V & Schranzdata
https://stardig.app/#sig-FEmiusB6oKs.Hard%20Techno'),
('♪ Get Me Hot — Xavion
https://stardig.app/#sig-BCQbL9SNyI0.Dance-pop'),
('♪ I Gave You My Heart (Didn''t I) — Hot Chocolate
https://stardig.app/#sig-FNMLK57NUg8.Disco'),
('♪ Energie — The Robot
https://stardig.app/#sig-OYABh4YOlYU.Hard%20Trance'),
('♪ Love Is A Battlefield — Fab!
https://stardig.app/#sig-h2hYwTTF2eg.Minimal'),
('♪ Aqua Boogie (Sender Of Rhythm Remix) — Aqua Boogie
https://stardig.app/#sig-XIf70E6xJvU.House'),
('♪ Waterproof — Zzino Vs. Accelerator
https://stardig.app/#sig-vUh1nEhE7g4.Techno'),
('♪ Jeg Går I Land — Pjusk
https://stardig.app/#sig-bqQgNMJqFOI.Ambient'),
('♪ Hella Stella — Various
https://stardig.app/#sig-oLJOZ42ExTM.Breakbeat'),
('♪ I Want to Party With Santa — Abelardo
https://stardig.app/#sig-HtSVz-dZgkk.Dance-pop'),
('♪ Defend (NTRSN Version) — Portion Control
https://stardig.app/#sig-T_yhtEfmF4I.EBM'),
('♪ Tortora Reeds — Yeskim
https://stardig.app/#sig-FPdFH1QyYOs.Dub'),
('♪ Gliss — Mattheis & Ranie Ribeiro
https://stardig.app/#sig-Ea4d00QOqFM.Techno'),
('♪ Som Ett Skal — Page
https://stardig.app/#sig-g0k1LPhLNws.Synth-pop'),
('♪ Cosmotherapy — Dream Lab
https://stardig.app/#sig-dHBR6Sl8n4w.Downtempo'),
('♪ Sunglasses At Night — Various
https://stardig.app/#sig-l7tNo5S6xEE.Electroclash'),
('♪ Labo 14 - Mac Md.wmv — Various
https://stardig.app/#sig-j17esXBhTts.Freetekno'),
('♪ Eternal Sunshine Of The Spotless Mind — Strvngers
https://stardig.app/#sig-I3D0aRrcgtg.Electroclash'),
('♪ Foxboy — Nicole Rosie
https://stardig.app/#sig-S0Ll75dcCVg.Techno'),
('♪ Its Alright , Its Ok — Cansis
https://stardig.app/#sig-We8yV_8u6Kg.Jumpstyle'),
('♪ COFFE & TULUMBA — Ahilea
https://stardig.app/#sig-59_KM08uSJ8.Future%20Jazz'),
('♪ Special Programming — Malcolm Arthur
https://stardig.app/#sig-mHNqOMsxmrA.Abstract'),
('♪ Megamix - Earth, Wind & Fire – Moon One — Earth, Wind & Fire
https://stardig.app/#sig-U6dukFnhJEc.Soul'),
('♪ SoundKilla — Vandal
https://stardig.app/#sig-6sgkjj-ehyo.Freetekno'),
('♪ ヤン富田 - C-Ya!〜Memories Of Tape Recorder — Yann Tomita
https://stardig.app/#sig-5DoT0_hGP9o.Musique%20Concr%C3%A8te'),
('♪ charleston — Christopher Just
https://stardig.app/#sig-3-2fQCs_yoI.Minimal'),
('♪ Golden Lights — DJ Unity
https://stardig.app/#sig-2apoulPJLDc.Happy%20Hardcore'),
('♪ .beatcon02 — SETI
https://stardig.app/#sig-NDzoOIaf0eg.Ambient'),
('♪ Footloose — Bus Stop
https://stardig.app/#sig-kCK543jmjuI.Eurodance'),
('♪ Live at Berlin Atonal 2014 — In Aeternam Vale
https://stardig.app/#sig-QMSKHYGq3Js.Noise'),
('♪ Phaedra — Bochum Welt
https://stardig.app/#sig-OXOh2cfxI5I.Acid'),
('♪ Signaling — PlayPlay
https://stardig.app/#sig-beofWIksmdg.Breaks'),
('♪ F.A.V. — Cosmic Gate
https://stardig.app/#sig-wuhml7OLSz4.Trance'),
('♪ Nuclear — Pattern J
https://stardig.app/#sig-b62U68i5aM8.Hardcore'),
('♪ Super String Theory — Ekiti Sound System
https://stardig.app/#sig-rgGRLMq5xPw.Synth-pop'),
('♪ Afrika — Snakemen
https://stardig.app/#sig-cSTBOGhC_zo.Hard%20Trance'),
('♪ Kumbayah — Various
https://stardig.app/#sig-o-waapXgUNY.Lo-Fi'),
('♪ TEC Hyperspace  Arabian Knights (Classic vinyl). — Hyperspace
https://stardig.app/#sig-Lmt8--3v7-s.Hard%20House'),
('♪ Raise — Boss Axis
https://stardig.app/#sig-o7IyQsZf_9k.Tech%20House'),
('♪ Strange Reunions — Yeasayer
https://stardig.app/#sig-hOWbdHaiYLA.Indie%20Rock'),
('♪ Cutters — Rumbler
https://stardig.app/#sig-laLl8w8W8lA.Hardcore'),
('♪ Echo Park — Flabaire
https://stardig.app/#sig-n8MRtm8eUTY.Deep%20House'),
('♪ Finest Gear — RNBWS
https://stardig.app/#sig-GCdRoOH3BWI.Electro'),
('♪ fp- (52500) — This Morn'' Omina
https://stardig.app/#sig-KYsb6h5ANUw.Rhythmic%20Noise'),
('♪ One Drop Of Rain — Various
https://stardig.app/#sig-82EeHjNtNQQ.Breakbeat'),
('♪ Trapped (Parham & Dominic Plaza Remix) — Kasey Taylor
https://stardig.app/#sig-iFAKF25OGos.Progressive%20House'),
('♪ The Struggle Of My People — Mike Grant
https://stardig.app/#sig-jF5qZw46pcM.Deep%20House'),
('♪ ROXANNE GIRLS Mega Mix #2 * The World Famous D.J. Spin Kut * Perfect Beat Records PB001Z — D.J. Spin Kut
https://stardig.app/#sig-LJ3Rbhy7Rzs.Electro'),
('♪ Triptych 76 (Original) — Flint Kids
https://stardig.app/#sig-NPeE0jviRLM.Leftfield'),
('♪ Demarcation Line — Arve Henriksen
https://stardig.app/#sig-KKownIky418.Experimental'),
('♪ Feeling — Alternate
https://stardig.app/#sig-mua7iKtRTlQ.Hardstyle'),
('♪ In Arts — Jamie Lie A Kwie
https://stardig.app/#sig-1Jl6ny3l718.Minimal%20Techno'),
('♪ Bad Boy — Miami Sound Machine
https://stardig.app/#sig-a3M2-D7txw8.Disco'),
('♪ The Nigerian Hustle — Various
https://stardig.app/#sig-piYNVfHhNWg.Deep%20House'),
('♪ Phase Shifting — Henning Schmitz
https://stardig.app/#sig--osdjPfRCRw.Boogie'),
('♪ Drunken Masters & Fatman D - Evil that men do — Dope Ammo
https://stardig.app/#sig-J6eKeVMnp3Y.Drum%20n%20Bass'),
('♪ Haters — Hypix
https://stardig.app/#sig-NyLK45GuvUY.Hardstyle'),
('♪ Escape (Perel Extended Remix) — Benjamin Fröhlich
https://stardig.app/#sig-8IrZddy8YZs.Deep%20House'),
('♪ Clouds (feat.  Astrid Engberg) — Hugo Kant
https://stardig.app/#sig-JHX6PuiawYc.Instrumental'),
('♪ COH Feat. Little Annie ‎– Yellow (Full Ep) — COH & Little Annie
https://stardig.app/#sig-hBT0Cusl_FA.Experimental'),
('♪ 夜行線上のフライト — Mintea
https://stardig.app/#sig-IlPjVJwgww4.Pop%20Rock'),
('♪ B2 - PESSIMIST PRODUCTIONS - PESS002 — Pessimist & Karim Maas
https://stardig.app/#sig-uFBqyV2Yvcw.Illbient'),
('♪ Moscow Nineteen Eighty — Kompleksi
https://stardig.app/#sig-F1YBu4g_RII.Krautrock'),
('♪ Stella — Yamaoka
https://stardig.app/#sig-gNsWUe4m1DY.Techno'),
('♪ Oskulden — Tarmvred
https://stardig.app/#sig-LHW6h2GaSbA.Breakcore'),
('♪ Vin'' sa ne-ntalnim (Official Audio) — Alegria
https://stardig.app/#sig-qAfjYPWdTGs.Eurodance'),
('♪ Rescue Me (N.Y. Club Mix) — Shaunessy
https://stardig.app/#sig-eI82cvi9Mb8.Garage%20House'),
('♪ One 2 Many - Another Man (Rhythm Stick Version) — Various
https://stardig.app/#sig-d1EAlrgiwmw.Hip-House'),
('♪ Sharing The Dancefloor — Cristian Paduraru
https://stardig.app/#sig-5pOFEWbZupY.Progressive%20House'),
('♪ Woza Uzova (Gated Vocal) — Okzharp & Samrai
https://stardig.app/#sig-oD3kCW0dCZg.Grime'),
('♪ My New Toy — Carlos Sánchez
https://stardig.app/#sig-cOa_-jUAWgk.Tech%20House'),
('♪ S.W.A.T — Nu Elementz & Slipz
https://stardig.app/#sig-9EPaMeGxHQo.Drum%20n%20Bass'),
('♪ Come & Get It (DJ Laszlo Club Remix) Lyrics — Selena Gomez & The Scene
https://stardig.app/#sig-nGSPCrQBSk0.Soundtrack'),
('♪ Dream Awake (Extended Mix) — Cuebrick & Manse
https://stardig.app/#sig-YCFpwDv5PBo.Electro%20House'),
('♪ Say Goodbye [BLACK] (RXK-01) — Khan & Julee Cruise
https://stardig.app/#sig-Sr9uaBPVq2g.Minimal'),
('♪ Credo — Bungaro
https://stardig.app/#sig-AfLjec5eJxc.Chanson'),
('♪ Infinite Highway — LANDOLSI
https://stardig.app/#sig-6beztodXHms.Synthwave'),
('♪ [EGxHC] MIRSY - thoughts i''ve kept inside - 2018 (Full EP) — MIRSY
https://stardig.app/#sig-iWvu9TgvcIo.Vaporwave'),
('♪ You — Jerry Paper
https://stardig.app/#sig-OUyex9cjRaE.Instrumental'),
('♪ Yaaah! (Official Video) — D-Shake
https://stardig.app/#sig-BFaz4nBzwik.Techno'),
('♪ Flexy Beast (Lil Mark''s Flexy Remix) — Lee Mortimer
https://stardig.app/#sig-KtBgdSRXuSY.Deep%20House'),
('♪ Cocktail Time — Souleance
https://stardig.app/#sig-Rq0bfpcuQ2c.Broken%20Beat'),
('♪ Sure Revision — Limewax & Arsenic
https://stardig.app/#sig-f53L0fuy_Ok.Drum%20n%20Bass'),
('♪ Shimmer (Superstrobe Remix) — Various
https://stardig.app/#sig-SPNAxX0NrQY.Deep%20Techno'),
('♪ My Only Desire — Body Base & Alexander Thompson
https://stardig.app/#sig-ecZExB2ea-U.Euro%20House'),
('♪ 2000 Watt — Various
https://stardig.app/#sig-dttG0p8JxJU.Techno'),
('♪ Boogie Claps — Duktus
https://stardig.app/#sig-wltu5GVita0.Instrumental'),
('♪ The Ragged Trousered Percussionist — Beats International
https://stardig.app/#sig-rMkznq007FY.Trip%20Hop'),
('♪ Oj Kaline, Oj Malina — Sebastian James Taylor
https://stardig.app/#sig-Jqq8AfzfrUc.Tribal'),
('♪ Viibryd — Viibryd
https://stardig.app/#sig-jcOdv4Hw3Ok.Vaporwave'),
('♪ Falls (feat. Sasha Alex Sloan) [Golden Features Remix] — Odesza & Sasha Sloan
https://stardig.app/#sig-7sK1aFH4dns.Dance-pop'),
('♪ Whenever You''re Ready (The New York Mix) — Five Star
https://stardig.app/#sig-FGXPyqFZ-Qk.Soul'),
('♪ Loaded — Unit:187
https://stardig.app/#sig-npsvYC37qV0.Industrial'),
('♪ Perfecto Allstarz - Reach Up (Papa''s Got A Brand New Pig Bag) (Indian Summer Remix) — Various
https://stardig.app/#sig-Y0X5mzyFupQ.Dance-pop'),
('♪ Unshakeable (Extended Mix) — Riko & Dash
https://stardig.app/#sig-f1lKXyLyIfI.Happy%20Hardcore'),
('♪ Hard And Holy — Mike Phobos
https://stardig.app/#sig-3srq3Eo-fAU.Hard%20Trance'),
('♪ Gotta Get Your Dub — Gary Davis & Sanction
https://stardig.app/#sig-3SjhgRQUjeI.Boogie');

-- the clock (re-running replaces it)
select cron.unschedule('stardig-tip') where exists (select 1 from cron.job where jobname = 'stardig-tip');
select cron.schedule('stardig-tip', '17 8,20 * * *', $$select public.post_tip()$$);
