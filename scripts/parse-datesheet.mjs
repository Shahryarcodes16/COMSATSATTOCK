import fs from 'fs';
import path from 'path';

const csvRaw = `,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BAF,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1010-1140,CSC101,Introduction to ICT,BAF-I,23,Sania Irum,LH1,"Abbas Ali Shah, Sania Irum"
2,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BAF-I,23,Imran Bashir,LH3,"Dr. Khalid Mahmood Awan, Dr. Midrar Ullah"
3,2026-11-06,1010-1140,MGT132,Principles of Accounting,BAF-I,23,Nazish Yameen Malak,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
4,2026-11-07,1500-1630,MGT102,Fundamentals of Management,BAF-I,23,Dr. Hamid Masood,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Muhammad Saleem Khan"
5,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BAF-I,23,Dr. Sohail Ahmad,LH1,"Munnazza Mushtaq, Narmeen khalid"
6,2026-11-10,1010-1140,ECO400,Business Economics,BAF-I,23,Dr. Asim Anwar,EEhall,"Muhammad Kamran, Adil Ihsan, Sanober Tariq, Abdul Ahad"
7,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BAF-II,21,Sanober Tariq,LH2,"Muhammad Kamran, Narmeen khalid"
8,2026-11-05,0830-1000,LAW300,Corporate Law,BAF-II,21,Dr.Muhammad Usman Shah,LH5,"Dr. Muhammad Numan, Dr. Muhammad Ozair"
9,2026-11-06,1010-1140,MGT132,Principles of Accounting,BAF-II,2,Narmeen Khalid,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
10,2026-11-06,1010-1140,MGT191,Financial Accounting,BAF-II,19,Nazish Yameen Malak,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
11,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BAF-II,21,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
12,2026-11-07,0830-1000,HUM120,Expository Writing,BAF-II,21,Dr.Muhammad Usman Shah,LH4,"Muhammad Kamran, Nazish Yameen Malak"
13,2026-11-09,0830-1000,HUM122,Fundamentals of Psychology,BAF-II,21,Dr. Midrar Ullah,LH1,"Raheel Zaman, Dr. Muhammad Sulaiman"
14,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BAF-II,1,Dr. Noor Muhammad,CR2,"Waqas Ahmed, Farwida Javed"
15,2026-11-10,1500-1630,MTH114,Tools for Quantitative Reasoning,BAF-II,20,Dr. Noor Muhammad,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
16,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BAF-III,20,Salman Yahya,LH2,"Muhammad Kamran, Narmeen khalid"
17,2026-11-04,1500-1630,HUM162,Understanding of Holy Quran – II (Fehm-e-Quran–II),BAF-III,17,Visiting Mgt Taimoor Farooq,LH5,"Dr. Sadaf Yasmin, Dr. Saeed Ehsan Awan"
18,2026-11-05,0830-1000,LAW300,Corporate Law,BAF-III,1,Dr.Muhammad Usman Shah,LH5,"Dr. Muhammad Numan, Dr. Muhammad Ozair"
19,2026-11-05,1150-1320,ACC201,Cost and Management Accounting,BAF-III,19,Dr. Noman Khan,CR4,"Dr. Noman Khan, Anam Moin"
20,2026-11-06,1010-1140,MGT191,Financial Accounting,BAF-III,2,Nazish Yameen Malak,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
21,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BAF-III,2,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
22,2026-11-06,1500-1630,PHY124,Applied Physics,BAF-III,19,Dr. Muhammad Numan,CR7,"Dr. Muhammad Numan, Adil Ihsan"
23,2026-11-07,0830-1000,HUM120,Expository Writing,BAF-III,2,Dr.Muhammad Usman Shah,LH4,"Muhammad Kamran, Nazish Yameen Malak"
24,2026-11-07,1010-1140,ECO410,Econometric Methods and Applications,BAF-III,18,Dr. Faisal Nawaz Mir,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
25,2026-11-07,1500-1630,HUM123,Fundamentals of Philosophy,BAF-III,21,Dr. Adeel Saqib,LH2,"Dr. Muhammad Yousaf Khan, Prof. Dr. Laiq Khan"
26,2026-11-09,0830-1000,HUM122,Fundamentals of Psychology,BAF-III,2,Dr. Midrar Ullah,LH1,"Raheel Zaman, Dr. Muhammad Sulaiman"
27,2026-11-09,1010-1140,ACC301,Intermediate Financial Accounting,BAF-III,19,Dr. Shabbir Haider,EEhall,"Dr. Shabbir Haider, Mehreen Wahab, Muhammad Fawad, Shanza Zafar"
28,2026-11-10,1500-1630,MTH114,Tools for Quantitative Reasoning,BAF-III,3,Dr. Noor Muhammad,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
29,2026-11-04,1150-1320,MGT232,Business Finance,BAF-IV,29,Dr. Muhammad Faisal Shahzad Mgt. Sc.,CR4,"Muhammad Fahad Khan, Shehzad Rizwan"
30,2026-11-05,1010-1140,MGT370,Auditing,BAF-IV,28,Dr. Shabbir Haider,LH4,"Dr. Muhammad Yousaf Khan, Ihtesham Jadoon"
31,2026-11-05,1330-1500,MGT300,Organizational Behavior,BAF-IV,28,Dr. Saddam Hussain,CR3,"Dr. Muhammad Saleem Khan, Dr. Muhammad Shahzad Faisal CS"
32,2026-11-06,1010-1140,MGT191,Financial Accounting,BAF-IV,1,Nazish Yameen Malak,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
33,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BAF-IV,29,Dr. Syed Asim Shah,LH4,"Dr. Syed Asim Shah, Fayaz Ali"
34,2026-11-07,1010-1140,ECO410,Econometric Methods and Applications,BAF-IV,29,Dr. Faisal Nawaz Mir,LH1,"Muhammad Kamran, Muhammad Qasim"
35,2026-11-07,1500-1630,MGT101,Introduction to Management,BAF-IV,1,Dr. Hamid Masood,CR4,"Dr. Hamid Masood, Visiting CS Javeria Kanwal"
36,2026-11-09,1010-1140,ACC301,Intermediate Financial Accounting,BAF-IV,1,Dr. Shabbir Haider,EEhall,"Dr. Shabbir Haider, Mehreen Wahab, Muhammad Fawad, Shanza Zafar"
37,2026-11-10,0830-1000,HUM112,Islamic Studies,BAF-IV,29,Aziz Ul Hassan,LH2,"Rabia Khatoon, Sameen Khalid"
38,2026-11-04,1010-1140,MGT387,Databases for Business,BAF-V,35,Visiting CS Javeria Kanwal,CR3,"Visiting CS Javeria Kanwal, Dr. Muhammad Ismail Khan"
39,2026-11-04,1150-1320,MGT232,Business Finance,BAF-V,1,Dr. Muhammad Faisal Shahzad Mgt. Sc.,CR4,"Muhammad Fahad Khan, Shehzad Rizwan"
40,2026-11-04,1330-1500,MGT301,Research Tools and Techniques,BAF-V,34,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
41,2026-11-05,1010-1140,MGT370,Auditing,BAF-V,36,Dr. Shabbir Haider,LH2,"Dr. Shabbir Haider, Kashif Jatoi"
42,2026-11-05,1330-1500,MGT300,Organizational Behavior,BAF-V,3,Dr. Saddam Hussain,CR3,"Dr. Muhammad Saleem Khan, Dr. Muhammad Shahzad Faisal CS"
43,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BAF-V,1,Dr. Syed Asim Shah,LH4,"Dr. Syed Asim Shah, Fayaz Ali"
44,2026-11-07,1010-1140,ECO410,Econometric Methods and Applications,BAF-V,1,Dr. Faisal Nawaz Mir,LH1,"Muhammad Kamran, Muhammad Qasim"
45,2026-11-07,1150-1320,MGT173,Programming Language for Business Analytics,BAF-V,35,Dr. Faisal Nawaz Mir,CR3,"Fayaz Ali, Nazish Yameen Malak"
46,2026-11-10,0830-1000,HUM112,Islamic Studies,BAF-V,1,Aziz Ul Hassan,LH2,"Rabia Khatoon, Sameen Khalid"
47,2026-11-10,1010-1140,ECO400,Business Economics,BAF-V,2,Dr. Asim Anwar,EEhall,"Muhammad Kamran, Adil Ihsan, Sanober Tariq, Abdul Ahad"
48,2026-11-10,1330-1500,MGT330,Financial Management,BAF-V,35,Nazish Yameen Malak,CR4,"Dr. Muhammad Sharif, Dr. Muhammad Sulaiman"
49,2026-11-04,1010-1140,MGT387,Databases for Business,BAF-VI,16,Qazi Zia Ullah,LH2,"Qazi Zia Ullah, Tahreem Khalil"
50,2026-11-05,0830-1000,LAW300,Corporate Law,BAF-VI,2,Dr.Muhammad Usman Shah,LH5,"Dr. Muhammad Numan, Dr. Muhammad Ozair"
51,2026-11-05,1150-1320,FIN472,Derivatives and Financial Risk Management,BAF-VI,17,Dr. Shabbir Haider,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Khalid Mahmood Awan"
52,2026-11-07,1150-1320,FIN450,Investment and Portfolio Management,BAF-VI,17,Dr. Noman Khan,LH2,"Dr. Noman Khan, Abbas Ali Shah"
53,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BAF-VI,1,Dr. Sohail Ahmad,LH1,"Munnazza Mushtaq, Narmeen khalid"
54,2026-11-10,1010-1140,ACC466,Financial Statement Analysis and Valuation,BAF-VI,17,Dr. Noman Khan,LH1,"Tasneem Fiza, Ayesha Nasir"
55,2026-11-10,1330-1500,MGT401,Corporate Governance,BAF-VI,17,Nazish Yameen Malak,CR3,"Nazish Yameen Malak, Dr. Muhammad Saleem Khan"
56,2026-11-04,1500-1630,FIN476,International Finance,BAF-VII,19,Dr. Asim Anwar,LH4,"Dr. Faisal Nawaz Mir, Dr. Mohammad Sardaraz"
57,2026-11-05,1150-1320,FIN472,Derivatives and Financial Risk Management,BAF-VII,19,Dr. Shabbir Haider,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Khalid Mahmood Awan"
58,2026-11-06,1010-1140,MGT132,Principles of Accounting,BAF-VII,2,Nazish Yameen Malak,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
59,2026-11-07,1150-1320,FIN450,Investment and Portfolio Management,BAF-VII,19,Dr. Noman Khan,CR3,"Fayaz Ali, Nazish Yameen Malak"
60,2026-11-09,1010-1140,ACC301,Intermediate Financial Accounting,BAF-VII,1,Dr. Shabbir Haider,EEhall,"Dr. Shabbir Haider, Mehreen Wahab, Muhammad Fawad, Shanza Zafar"
61,2026-11-10,1010-1140,ACC466,Financial Statement Analysis and Valuation,BAF-VII,19,Dr. Noman Khan,CR4,"Dr. Asim Anwar, Abbas Ali Shah"
62,2026-11-10,1330-1500,MGT401,Corporate Governance,BAF-VII,19,Nazish Yameen Malak,EEhall,"Dr. Yaser Ali Shah, Dr. Muhammad Zeb, Dr. Shahid Hussain, Dr. Syed Asim Shah"
63,2026-11-04,1010-1140,MGT101,Introduction to Management,BAF-VIII,1,Dr. Midrar Ullah,LH2,"Qazi Zia Ullah, Tahreem Khalil"
64,2026-11-04,1500-1630,MGT530,International Finance,BAF-VIII,13,Dr. Asim Anwar,LH4,"Dr. Faisal Nawaz Mir, Dr. Mohammad Sardaraz"
65,2026-11-05,1150-1320,FIN550,Derivatives and Financial Risk Management,BAF-VIII,13,Dr. Shabbir Haider,CR4,"Dr. Noman Khan, Anam Moin"
66,2026-11-06,1010-1140,MGT502,Accounting Information System,BAF-VIII,1,Dr. Faisal Nawaz Mir,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
67,2026-11-10,1010-1140,ACC556,Financial Statement Analysis and Valuation,BAF-VIII,13,Dr. Noman Khan,LH2,"Fouzia Jabeen, Kamran Ali"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,Bachelor of Science in Artificial Intelligence,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BAI-I,60,Sameen Khalid,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
2,2026-11-05,1010-1140,HUM122,Fundamentals of Psychology,BAI-I,60,Muhammad Usman,EEhall,"Muhammad Usman, Umar Zia, Raheel Zaman"
3,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BAI-I,60,Tahreem Khalil,EEhall,"Tahreem Khalil, Dr. Farooq Ahmed Shah, Fayaz Ali, Fouzia Jabeen"
4,2026-11-06,1500-1630,CSC101,Introduction to ICT,BAI-I,60,Muhammad Fahad Khan,EEhall,"Dr. Ali Imran, AttaUllah, Ayesha Nasir, Anam Moin"
5,2026-11-07,1330-1500,HUM104,Functional English,BAI-I,60,Tasneem Fiza,EEhall,"Imran Bashir, Irshad Ullah, Kashif Jatoi, Abdul Ahad"
6,2026-11-09,0830-1000,MTH091,Pre-Calculus I,BAI-I,18,Dr. Muhammad Sulaiman,LH4,"Imran Bashir, Irshad Ullah"
7,2026-11-10,0830-1000,HUM112,Islamic Studies,BAI-I,60,Aziz Ul Hassan,EEhall,"Dr. Muhammad Usman Shah, Fayaz Ali, Kashif Jatoi, Marwa Khanam"
8,2026-11-04,1500-1630,CSC102,Discrete Structures,BAI-III,1,Mehreen Wahab,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
9,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BAI-III,58,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
10,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BAI-III,8,Dr. Muazzam Maqsood,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
11,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BAI-III,50,Syed Usman Anwar,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
12,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BAI-III,16,Dr. Farooq Ahmed Shah,LH2,"Kashif Jatoi, Marwa Khanam"
13,2026-11-06,1500-1630,CSC275,Computer Networks,BAI-III,55,Muhammad Fahad Khan,CR2,"Tasneem Fiza, Abbas Ali Shah"
14,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BAI-III,58,Salah Ud Din,EEhall,"Dr. Attiq Ur Rehman, Ihtesham Jadoon, Mubashir Rehman, Sania Irum"
15,2026-11-09,0830-1000,MTH092,Pre-Calculus II,BAI-III,1,Adil Ihsan,CR4,"Adil Ihsan, Qazi Zia Ullah"
16,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BAI-III,8,Muhammad Waseem Khan,EEhall,"Dr. Muhammad Usman Shah, Fayaz Ali, Kashif Jatoi, Marwa Khanam"
17,2026-11-10,1150-1320,CSC270,Database Systems,BAI-III,58,Shehzad Rizwan,EEhall,"Mehreen Wahab, Dr. Ehtesham Ul Mujeeb, Dr. Hamid Masood, Dr. Midrar Ullah"
18,2026-11-04,1010-1140,AIC270,Programming for Artificial Intelligence,BAI-V,51,Fouzia Jabeen,EEhall,"Akbar Ali Khan Afridi, Fouzia Jabeen, Waqas Ahmed, Syed Bilal Haider Bukhari"
19,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BAI-V,1,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
20,2026-11-05,1010-1140,AIC372,Knowledge Representation and Reasoning,BAI-V,51,Dr. Muhammad Sharif,CR2,"Dr. Muhammad Sharif, Dr. Muhammad Zeb"
21,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BAI-V,1,Dr. Farooq Ahmed Shah,LH2,"Kashif Jatoi, Marwa Khanam"
22,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BAI-V,51,Syed Bilal Haider Bukhari,EEhall,"Muhammad Waseem Khan, Munnazza Mushtaq, Noor ul Ain, Salah Ud Din"
23,2026-11-06,1500-1630,CSC275,Computer Networks,BAI-V,1,Muhammad Fahad Khan,CR2,"Tasneem Fiza, Abbas Ali Shah"
24,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BAI-V,51,Sadia Ejaz,CR2,"Sadia Ejaz, Dr. Muhammad Usman Shah"
25,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BAI-V,1,Salah Ud Din,EEhall,"Dr. Attiq Ur Rehman, Ihtesham Jadoon, Mubashir Rehman, Sania Irum"
26,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BAI-V,51,AttaUllah,CR2,"AttaUllah, Muhammad Fawad"
27,2026-11-10,1150-1320,CSC270,Database Systems,BAI-V,1,Shehzad Rizwan,EEhall,"Mehreen Wahab, Dr. Ehtesham Ul Mujeeb, Dr. Hamid Masood, Dr. Midrar Ullah"
28,2026-11-10,1150-1320,CSC336,Web Technologies,BAI-V,51,Irshad Ullah,CR4,"Irshad Ullah, Dr. Attiq Ur Rehman"
29,2026-11-04,1010-1140,AIC270,Programming for Artificial Intelligence,BAI-VII,1,Fouzia Jabeen,EEhall,"Akbar Ali Khan Afridi, Fouzia Jabeen, Waqas Ahmed, Syed Bilal Haider Bukhari"
30,2026-11-05,1010-1140,AIC372,Knowledge Representation and Reasoning,BAI-VII,3,Dr. Muhammad Sharif,CR2,"Dr. Muhammad Sharif, Dr. Muhammad Zeb"
31,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BAI-VII,1,Syed Usman Anwar,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
32,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BAI-VII,3,Dr. Farooq Ahmed Shah,LH2,"Kashif Jatoi, Marwa Khanam"
33,2026-11-06,1150-1320,DSC306,Data Mining,BAI-VII,46,Dr. Sadaf Yasmin,LH1,"Dr. Sadaf Yasmin, Salman Yahya"
34,2026-11-06,1500-1630,CSC275,Computer Networks,BAI-VII,1,Muhammad Fahad Khan,CR2,"Tasneem Fiza, Abbas Ali Shah"
35,2026-11-06,1500-1630,CSC325,Computer Organization & Assembly Language,BAI-VII,3,Syed Bilal Haider Bukhari,LH2,"Syed Bilal Haider Bukhari, Faiza Khan"
36,2026-11-07,1010-1140,AIC350,Topics in Artificial Intelligence I,BAI-VII,45,Salah Ud Din,CR3,"Salah Ud Din, Kamran Ali"
37,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BAI-VII,45,Dr. Muhammad Ozair,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
38,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BAI-VII,13,Dr. Takasar Hussain,LH4,"Imran Bashir, Irshad Ullah"
39,2026-11-10,1010-1140,CSC418,DevOps for Cloud Computing,BAI-VII,45,Babar Shazad,EEhall,"Muhammad Kamran, Adil Ihsan, Sanober Tariq, Abdul Ahad"
40,2026-11-10,1150-1320,CSC270,Database Systems,BAI-VII,1,Shehzad Rizwan,EEhall,"Mehreen Wahab, Dr. Ehtesham Ul Mujeeb, Dr. Hamid Masood, Dr. Midrar Ullah"
41,2026-11-04,1150-1320,AIC354,Machine Learning Fundamentals,BAI-IX,1,Dr. Muazzam Maqsood,CR2,"Muhammad Qasim, Dr. Muhammad Usman Shah"
42,2026-11-04,1330-1500,MGT101,Introduction to Management,BAI-IX,2,Dr. Saddam Hussain,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
43,2026-11-05,1150-1320,AIC365,Natural Language Processing,BAI-IX,1,Tahreem Khalil,CR2,"Tahreem Khalil, Dr. Sadaf Yasmin"
44,2026-11-05,1150-1320,EEE241,Digital Logic Design,BAI-IX,1,Farwida Javed,CR4,"Dr. Noman Khan, Anam Moin"
45,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BAI-IX,1,Syed Usman Anwar,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
46,2026-11-06,0830-1000,CSC334,Parallel and Distributed Computing,BAI-IX,2,Kamran Ali,CR3,"Kamran Ali, Noor ul Ain"
47,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BAI-IX,1,Anam Moin,CR2,"Dr. Mohammad Sardaraz, Muhammad Fawad"
48,2026-11-06,1500-1630,CSC325,Computer Organization & Assembly Language,BAI-IX,1,Syed Bilal Haider Bukhari,LH2,"Syed Bilal Haider Bukhari, Faiza Khan"
49,2026-11-06,1500-1630,CSC340,Computer Networks,BAI-IX,1,Shehzad Rizwan,CR4,"Muhammad Fawad, Abdul Ahad"
50,2026-11-07,1010-1140,AIC380,Artificial Neural Networks,BAI-IX,1,Maryam Bibi,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
51,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BAI-IX,5,Dr. Muhammad Ozair,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
52,2026-11-04,1150-1320,AIC354,Machine Learning Fundamentals,BAI-X,1,Dr. Muazzam Maqsood,CR2,"Muhammad Qasim, Dr. Muhammad Usman Shah"
53,2026-11-05,1330-1500,HUM220,Introduction to Psychology,BAI-X,1,Muhammad Usman,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
54,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BAI-X,1,Syed Usman Anwar,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
55,2026-11-06,1500-1630,CSC325,Computer Organization & Assembly Language,BAI-X,1,Syed Bilal Haider Bukhari,LH2,"Syed Bilal Haider Bukhari, Faiza Khan"
56,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BAI-X,2,Dr. Muhammad Ozair,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,Bachelor of Business Administration,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1010-1140,CSC101,Introduction to ICT,BBA-I,22,Adil Ihsan,CR4,"Dr. Midrar Ullah, Adil Ihsan"
2,2026-11-04,1330-1500,MGT102,Fundamentals of Management,BBA-I,22,Dr. Saddam Hussain,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
3,2026-11-06,1010-1140,MGT132,Principles of Accounting,BBA-I,22,Narmeen Khalid,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
4,2026-11-07,1330-1500,HUM104,Functional English,BBA-I,22,Tasneem Fiza,CR4,"Dr. Shabbir Haider, Ayesha Nasir"
5,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BBA-I,22,Dr. Noor Muhammad,CR4,"Dr. Sohail Ahmad, Dr. Noor Muhammad"
6,2026-11-10,1010-1140,ECO400,Business Economics,BBA-I,22,Dr. Asim Anwar,CR4,"Dr. Asim Anwar, Abbas Ali Shah"
7,2026-11-04,1010-1140,CSC101,Introduction to ICT,BBA-II,2,Adil Ihsan,CR4,"Dr. Midrar Ullah, Adil Ihsan"
8,2026-11-04,1010-1140,MGT101,Introduction to Management,BBA-II,24,Dr. Midrar Ullah,CR4,"Dr. Midrar Ullah, Adil Ihsan"
9,2026-11-04,1330-1500,MGT101,Introduction to Management,BBA-II,2,Dr. Saddam Hussain,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
10,2026-11-06,1010-1140,MGT132,Principles of Accounting,BBA-II,3,Narmeen Khalid,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
11,2026-11-06,1010-1140,MGT191,Financial Accounting,BBA-II,23,Nazish Yameen Malak,CR2,"Nazish Yameen Malak, Ayesha Nasir"
12,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BBA-II,24,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
13,2026-11-07,0830-1000,HUM120,Expository Writing,BBA-II,24,Dr.Muhammad Usman Shah,LH2,"AttaUllah, Ayesha Nasir"
14,2026-11-07,1330-1500,HUM104,Functional English,BBA-II,26,Tasneem Fiza,CR4,"Dr. Shabbir Haider, Ayesha Nasir"
15,2026-11-09,0830-1000,HUM122,Fundamentals of Psychology,BBA-II,23,Dr. Midrar Ullah,CR4,"Adil Ihsan, Qazi Zia Ullah"
16,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BBA-II,4,Dr. Noor Muhammad,CR4,"Dr. Sohail Ahmad, Dr. Noor Muhammad"
17,2026-11-10,1010-1140,ECO400,Business Economics,BBA-II,3,Dr. Asim Anwar,CR4,"Dr. Asim Anwar, Abbas Ali Shah"
18,2026-11-10,1500-1630,MTH114,Tools for Quantitative Reasoning,BBA-II,22,Dr. Noor Muhammad,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
19,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BBA-III,20,Salman Yahya,LH1,"Mehreen Wahab, Muhammad Fawad"
20,2026-11-04,1010-1140,MGT101,Introduction to Management,BBA-III,2,Dr. Midrar Ullah,CR4,"Dr. Midrar Ullah, Adil Ihsan"
21,2026-11-04,1500-1630,HUM162,Understanding of Holy Quran – II (Fehm-e-Quran–II),BBA-III,20,Visiting Mgt Taimoor Farooq,LH4,"Dr. Faisal Nawaz Mir, Dr. Mohammad Sardaraz"
22,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BBA-III,20,Imran Bashir,LH4,"Dr. Muhammad Ayub, Dr. Muhammad Ismail Khan"
23,2026-11-05,1150-1320,ACC201,Cost and Management Accounting,BBA-III,20,Dr. Noman Khan,CR4,"Dr. Noman Khan, Anam Moin"
24,2026-11-06,1010-1140,MGT132,Principles of Accounting,BBA-III,1,Narmeen Khalid,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
25,2026-11-06,1010-1140,MGT191,Financial Accounting,BBA-III,1,Nazish Yameen Malak,CR2,"Nazish Yameen Malak, Ayesha Nasir"
26,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BBA-III,2,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
27,2026-11-06,1500-1630,PHY124,Applied Physics,BBA-III,20,Dr. Muhammad Numan,CR7,"Dr. Muhammad Numan, Adil Ihsan"
28,2026-11-07,0830-1000,HUM120,Expository Writing,BBA-III,2,Dr.Muhammad Usman Shah,LH2,"AttaUllah, Ayesha Nasir"
29,2026-11-07,1330-1500,HUM104,Functional English,BBA-III,2,Tasneem Fiza,CR4,"Dr. Shabbir Haider, Ayesha Nasir"
30,2026-11-07,1330-1500,MGT243,E-Business,BBA-III,20,Sadia Ejaz,LH1,"Marwa Khanam, Maryam bibi"
31,2026-11-09,0830-1000,HUM122,Fundamentals of Psychology,BBA-III,2,Dr. Midrar Ullah,CR4,"Adil Ihsan, Qazi Zia Ullah"
32,2026-11-09,1150-1320,MTH264,Statistical Inference,BBA-III,20,Dr. Shahid Hussain,LH1,"Munnazza Mushtaq, Narmeen khalid"
33,2026-11-10,1500-1630,MTH114,Tools for Quantitative Reasoning,BBA-III,2,Dr. Noor Muhammad,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
34,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BBA-IV,2,Salman Yahya,LH1,"Mehreen Wahab, Muhammad Fawad"
35,2026-11-04,1150-1320,MGT232,Business Finance,BBA-IV,21,Dr. Muhammad Faisal Shahzad Mgt. Sc.,LH1,"Dr. Muhammad Ayub, Muhammad Waseem Khan"
36,2026-11-05,0830-1000,MGT350,Human Resource Management,BBA-IV,23,Dr. Muhammad Imran Malik,CR7,"Dr. Takasar Hussain, Armughan Ali"
37,2026-11-05,1150-1320,ACC201,Cost and Management Accounting,BBA-IV,2,Dr. Noman Khan,CR4,"Dr. Noman Khan, Anam Moin"
38,2026-11-06,1010-1140,MGT191,Financial Accounting,BBA-IV,1,Nazish Yameen Malak,CR2,"Nazish Yameen Malak, Ayesha Nasir"
39,2026-11-06,1010-1140,MGT311,Marketing Management in Digital Era,BBA-IV,21,Dr. Syed Asim Shah,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
40,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BBA-IV,23,Dr. Syed Asim Shah,LH4,"Dr. Syed Asim Shah, Fayaz Ali"
41,2026-11-07,1150-1320,MGT380,Global Business Management,BBA-IV,23,Sameen Khalid,LH2,"Dr. Noman Khan, Abbas Ali Shah"
42,2026-11-07,1500-1630,HUM123,Fundamentals of Philosophy,BBA-IV,22,Dr. Adeel Saqib,CR4,"Dr. Hamid Masood, Visiting CS Javeria Kanwal"
43,2026-11-10,1500-1630,MTH114,Tools for Quantitative Reasoning,BBA-IV,1,Dr. Noor Muhammad,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
44,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BBA-V,1,Salman Yahya,LH1,"Mehreen Wahab, Muhammad Fawad"
45,2026-11-04,1150-1320,MGT232,Business Finance,BBA-V,1,Dr. Muhammad Faisal Shahzad Mgt. Sc.,LH1,"Dr. Muhammad Ayub, Muhammad Waseem Khan"
46,2026-11-04,1330-1500,MGT301,Research Tools and Techniques,BBA-V,32,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
47,2026-11-05,0830-1000,LAW300,Corporate Law,BBA-V,33,Dr.Muhammad Usman Shah,LH4,"Dr. Muhammad Ayub, Dr. Muhammad Ismail Khan"
48,2026-11-05,0830-1000,MGT350,Human Resource Management,BBA-V,1,Dr. Muhammad Imran Malik,CR7,"Dr. Takasar Hussain, Armughan Ali"
49,2026-11-05,1330-1500,MGT300,Organizational Behavior,BBA-V,33,Dr. Saddam Hussain,CR2,"Dr. Saddam Hussain, Akbar Ali Khan Afridi"
50,2026-11-06,1010-1140,MGT311,Marketing Management in Digital Era,BBA-V,32,Dr. Syed Asim Shah,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
51,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BBA-V,2,Dr. Syed Asim Shah,LH4,"Dr. Syed Asim Shah, Fayaz Ali"
52,2026-11-07,1150-1320,MGT380,Global Business Management,BBA-V,33,Sameen Khalid,CR4,"Sameen Khalid, Sanober Tariq"
53,2026-11-07,1500-1630,HUM123,Fundamentals of Philosophy,BBA-V,1,Dr. Adeel Saqib,CR4,"Dr. Hamid Masood, Visiting CS Javeria Kanwal"
54,2026-11-09,1150-1320,MTH264,Statistical Inference,BBA-V,2,Dr. Shahid Hussain,LH1,"Munnazza Mushtaq, Narmeen khalid"
55,2026-11-10,1330-1500,MGT330,Financial Management,BBA-V,33,Nazish Yameen Malak,CR3,"Nazish Yameen Malak, Dr. Muhammad Saleem Khan"
56,2026-11-04,1010-1140,MGT387,Databases for Business,BBA-VI,19,Qazi Zia Ullah,LH2,"Qazi Zia Ullah, Tahreem Khalil"
57,2026-11-04,1330-1500,HRM474,Crisis and Conflict Management,BBA-VI,5,Dr. Muhammad Imran Malik,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
58,2026-11-04,1330-1500,MGT301,Research Tools and Techniques,BBA-VI,1,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
59,2026-11-04,1500-1630,MKT486,Seminar in Marketing,BBA-VI,5,Salman Yahya,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
60,2026-11-05,0830-1000,LAW300,Corporate Law,BBA-VI,1,Dr.Muhammad Usman Shah,LH4,"Dr. Muhammad Ayub, Dr. Muhammad Ismail Khan"
61,2026-11-05,1150-1320,FIN472,Derivatives and Financial Risk Management,BBA-VI,9,Dr. Shabbir Haider,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Khalid Mahmood Awan"
62,2026-11-05,1330-1500,MGT300,Organizational Behavior,BBA-VI,1,Dr. Saddam Hussain,CR2,"Dr. Saddam Hussain, Akbar Ali Khan Afridi"
63,2026-11-05,1500-1630,MGT470,Strategic Management,BBA-VI,19,Dr. Saddam Hussain,LH1,"Dr. Yaser Ali Shah, Farwida Javed"
64,2026-11-06,1010-1140,MGT311,Marketing Management in Digital Era,BBA-VI,3,Dr. Syed Asim Shah,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
65,2026-11-06,1010-1140,MKT474,New Product Development,BBA-VI,5,Dr. Ehtesham Ul Mujeeb,CR2,"Nazish Yameen Malak, Ayesha Nasir"
66,2026-11-06,1500-1630,HRM479,Performance and Career Management,BBA-VI,5,Muhammad Usman,LH2,"Syed Bilal Haider Bukhari, Faiza Khan"
67,2026-11-06,1500-1630,PHY124,Applied Physics,BBA-VI,1,Dr. Muhammad Numan,CR7,"Dr. Muhammad Numan, Adil Ihsan"
68,2026-11-07,1150-1320,MGT380,Global Business Management,BBA-VI,1,Sameen Khalid,CR4,"Sameen Khalid, Sanober Tariq"
69,2026-11-07,1150-1320,MGT461,Project Management,BBA-VI,19,Sanober Tariq,CR4,"Sameen Khalid, Sanober Tariq"
70,2026-11-10,1010-1140,ACC466,Financial Statement Analysis and Valuation,BBA-VI,9,Dr. Noman Khan,LH1,"Tasneem Fiza, Ayesha Nasir"
71,2026-11-10,1330-1500,MGT330,Financial Management,BBA-VI,5,Nazish Yameen Malak,CR3,"Nazish Yameen Malak, Dr. Muhammad Saleem Khan"
72,2026-11-04,0830-1000,HRM476,Compensation Management,BBA-VII,3,Sameen Khalid,CR3,"Sameen Khalid, AttaUllah"
73,2026-11-04,1010-1140,MGT101,Introduction to Management,BBA-VII,3,Dr. Midrar Ullah,CR4,"Dr. Midrar Ullah, Adil Ihsan"
74,2026-11-04,1150-1320,MKT481,Advertising and Event Management,BBA-VII,2,Dr.Muhammad Usman Shah,CR3,"Ihtesham Jadoon, Mubashir Rehman"
75,2026-11-04,1330-1500,HRM474,Crisis and Conflict Management,BBA-VII,3,Dr. Muhammad Imran Malik,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
76,2026-11-04,1500-1630,FIN476,International Finance,BBA-VII,9,Dr. Asim Anwar,LH2,"Visiting Mgt Taimoor Farooq, Dr. Asim Anwar"
77,2026-11-04,1500-1630,MKT486,Seminar in Marketing,BBA-VII,2,Salman Yahya,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
78,2026-11-05,1150-1320,FIN472,Derivatives and Financial Risk Management,BBA-VII,9,Dr. Shabbir Haider,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Khalid Mahmood Awan"
79,2026-11-05,1500-1630,MGT470,Strategic Management,BBA-VII,14,Dr. Saddam Hussain,LH1,"Dr. Yaser Ali Shah, Farwida Javed"
80,2026-11-06,1010-1140,MKT474,New Product Development,BBA-VII,2,Dr. Ehtesham Ul Mujeeb,CR2,"Nazish Yameen Malak, Ayesha Nasir"
81,2026-11-06,1500-1630,HRM479,Performance and Career Management,BBA-VII,3,Muhammad Usman,LH2,"Syed Bilal Haider Bukhari, Faiza Khan"
82,2026-11-09,1150-1320,MTH264,Statistical Inference,BBA-VII,1,Dr. Shahid Hussain,LH1,"Munnazza Mushtaq, Narmeen khalid"
83,2026-11-10,1010-1140,ACC466,Financial Statement Analysis and Valuation,BBA-VII,9,Dr. Noman Khan,LH1,"Tasneem Fiza, Ayesha Nasir"
84,2026-11-10,1330-1500,MGT401,Corporate Governance,BBA-VII,14,Nazish Yameen Malak,CR4,"Dr. Muhammad Sharif, Dr. Muhammad Sulaiman"
85,2026-11-04,0830-1000,MGT552,compensation management,BBA-VIII,20,Sameen Khalid,LH4,"Noor ul Ain, Salah Ud Din"
86,2026-11-04,1150-1320,MGT520,AEM,BBA-VIII,3,Dr.Muhammad Usman Shah,CR2,"Muhammad Qasim, Dr. Muhammad Usman Shah"
87,2026-11-04,1330-1500,MGT550,Crisis and Conflict Management,BBA-VIII,20,Dr. Muhammad Imran Malik,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
88,2026-11-04,1500-1630,MGT525,Seminar in Marketing,BBA-VIII,3,Salman Yahya,LH4,"Dr. Faisal Nawaz Mir, Dr. Mohammad Sardaraz"
89,2026-11-05,1150-1320,ACF550,Derivatives and Financial Risk Management,BBA-VIII,5,Dr. Shabbir Haider,CR2,"Tahreem Khalil, Dr. Sadaf Yasmin"
90,2026-11-05,1500-1630,MGT501,Strategic Management,BBA-VIII,28,Dr. Saddam Hussain,CR3,"Dr. Noor Muhammad, Dr. Shahid Hussain"
91,2026-11-06,1010-1140,HUM432,Arbc,BBA-VIII,1,Visiting Mgt Taimoor Farooq,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
92,2026-11-06,1010-1140,MGT513,New Product Development,BBA-VIII,3,Dr. Ehtesham Ul Mujeeb,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
93,2026-11-06,1010-1140,MGT540,Seminar in Finance,BBA-VIII,5,Dr. Asim Anwar,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
94,2026-11-06,1500-1630,MGT555,Perf & Cr Mngt,BBA-VIII,20,Muhammad Usman,CR1,"Muhammad Usman, Farwida Javed"
95,2026-11-07,1010-1140,ECO101,Macro Economics,BBA-VIII,3,Dr. Asim Anwar,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
96,2026-11-07,1500-1630,HUM223,Introduction to Philosophy,BBA-VIII,1,Dr. Adeel Saqib,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
97,2026-11-07,1500-1630,MGT557,Strategic Human Resource Management,BBA-VIII,2,Dr. Adeel Saqib,CR4,"Dr. Hamid Masood, Visiting CS Javeria Kanwal"
98,2026-11-10,0830-1000,HUM110,Islamic Studies,BBA-VIII,1,Dr.Muhammad Usman Shah,EEhall,"Dr. Muhammad Usman Shah, Fayaz Ali, Kashif Jatoi, Marwa Khanam"
99,2026-11-10,1010-1140,ACC556,Financial Statement Analysis and Valuation,BBA-VIII,5,Dr. Noman Khan,CR2,"Babar Shazad, Dr. Noman Khan"
100,2026-11-10,1330-1500,MGT401,Corporate Governance,BBA-VIII,3,Nazish Yameen Malak,CR4,"Dr. Muhammad Sharif, Dr. Muhammad Sulaiman"
101,2026-11-04,1150-1320,MGT520,AEM,BBA-IX,1,Dr.Muhammad Usman Shah,CR2,"Muhammad Qasim, Dr. Muhammad Usman Shah"
102,2026-11-05,1500-1630,MGT501,Strategic Management,BBA-IX,1,Dr. Saddam Hussain,CR3,"Dr. Noor Muhammad, Dr. Shahid Hussain"
103,2026-11-07,1500-1630,HUM223,Introduction to Philosophy,BBA-IX,1,Dr. Adeel Saqib,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BBD,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1010-1140,MGT171,Computing Technologies for Business,BBD-I,29,Abbas Ali Shah,LH1,"Abbas Ali Shah, Sania Irum"
2,2026-11-06,1010-1140,MGT132,Principles of Accounting,BBD-I,29,Nazish Yameen Malak,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
3,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BBD-I,29,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
4,2026-11-07,1150-1320,MGT173,Programming Language for Business Analytics,BBD-I,29,Dr. Faisal Nawaz Mir,LH1,"Muhammad Fahad Khan, Rabia Khatoon"
5,2026-11-07,1500-1630,MGT102,Fundamentals of Management,BBD-I,29,Dr. Hamid Masood,CR4,"Dr. Hamid Masood, Visiting CS Javeria Kanwal"
6,2026-11-09,0830-1000,HUM122,Fundamentals of Psychology,BBD-I,29,Dr. Midrar Ullah,CR4,"Adil Ihsan, Qazi Zia Ullah"
7,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BBD-I,29,Dr. Sohail Ahmad,CR4,"Dr. Sohail Ahmad, Dr. Noor Muhammad"
8,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BBD-II,8,Sanober Tariq,LH4,"Noor ul Ain, Salah Ud Din"
9,2026-11-05,0830-1000,LAW300,Corporate Law,BBD-II,8,Dr.Muhammad Usman Shah,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
10,2026-11-05,1150-1320,ACC201,Cost and Management Accounting,BBD-II,8,Dr. Noman Khan,LH2,"Dr. Midrar Ullah, Dr. Muhammad Numan"
11,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BBD-II,8,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
12,2026-11-07,1330-1500,HUM104,Functional English,BBD-II,8,Tasneem Fiza,EEhall,"Imran Bashir, Irshad Ullah, Kashif Jatoi, Abdul Ahad"
13,2026-11-10,1500-1630,MGT172,Mathematics for Business Analytics,BBD-II,8,Dr. Muhammad Ozair,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
14,2026-11-04,1010-1140,MGT101,Introduction to Management,BBD-III,1,Dr. Midrar Ullah,CR4,"Dr. Midrar Ullah, Adil Ihsan"
15,2026-11-04,1500-1630,HUM162,Understanding of Holy Quran – II (Fehm-e-Quran–II),BBD-III,23,Visiting Mgt Taimoor Farooq,LH2,"Visiting Mgt Taimoor Farooq, Dr. Asim Anwar"
16,2026-11-05,0830-1000,MGT350,Human Resource Management,BBD-III,24,Dr. Muhammad Imran Malik,CR1,"Dr. Muhammad Imran Malik, Adil Ihsan"
17,2026-11-05,1150-1320,ACC201,Cost and Management Accounting,BBD-III,4,Dr. Noman Khan,LH2,"Dr. Midrar Ullah, Dr. Muhammad Numan"
18,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BBD-III,24,Dr. Syed Asim Shah,LH5,"Qazi Zia Ullah, Fouzia Jabeen"
19,2026-11-07,0830-1000,HUM120,Expository Writing,BBD-III,23,Dr.Muhammad Usman Shah,LH4,"Muhammad Kamran, Nazish Yameen Malak"
20,2026-11-07,1330-1500,MGT243,E-Business,BBD-III,23,Sadia Ejaz,CR3,"Narmeen khalid, Sadia Ejaz"
21,2026-11-09,0830-1000,MGT272,Advanced Mathematics for Business Analytics,BBD-III,18,Dr. Ali Imran,LH4,"Imran Bashir, Irshad Ullah"
22,2026-11-10,1010-1140,PHY124,Applied Physics,BBD-III,23,Dr. Assad Hafiz,CR3,"Dr. Saeed Ehsan Awan, Dr. Assad Hafiz"
23,2026-11-10,1500-1630,MGT172,Mathematics for Business Analytics,BBD-III,5,Dr. Muhammad Ozair,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BCE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1330-1500,MTH211,Discrete Mathematics,BCE-I,31,Sania Irum,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
2,2026-11-05,0830-1000,CSC101,Introduction to ICT,BCE-I,31,Dr. Shujaat Ali Khan,LH5,"Dr. Muhammad Numan, Dr. Muhammad Ozair"
3,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BCE-I,31,Dr. Muhammad Awais,LH2,"Kashif Jatoi, Marwa Khanam"
4,2026-11-07,1330-1500,HUM104,Functional English,BCE-I,31,Narmeen Khalid,CR3,"Narmeen khalid, Sadia Ejaz"
5,2026-11-10,1010-1140,PHY124,Applied Physics,BCE-I,31,Dr. Saeed Ehsan Awan,CR3,"Dr. Saeed Ehsan Awan, Dr. Assad Hafiz"
6,2026-11-04,1330-1500,MTH242,Differential Equations,BCE-III,1,Adil Ihsan,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
7,2026-11-05,1150-1320,CPE241,Digital Logic Design,BCE-III,23,Farwida Javed,EEhall,"Shanza Zafar, Armughan Ali, Dr. Ata ur Rehman, Dr. Adeel Saqib"
8,2026-11-06,1150-1320,CSC291,Software Engineering Concepts,BCE-III,23,Raheel Zaman,LH4,"Raheel Zaman, Sanober Tariq"
9,2026-11-07,1500-1630,CPE231,Electronic Devices and Circuits,BCE-III,23,Ihtesham Jadoon,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Muhammad Saleem Khan"
10,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BCE-III,23,Rabia Khatoon,LH2,"Rabia Khatoon, Sameen Khalid"
11,2026-11-04,1010-1140,CPE324,Digital Signal Processing,BCE-V,19,Dr. Muhammad Ismail Khan,CR3,"Visiting CS Javeria Kanwal, Dr. Muhammad Ismail Khan"
12,2026-11-05,1150-1320,CPE241,Digital Logic Design,BCE-V,1,Farwida Javed,EEhall,"Shanza Zafar, Armughan Ali, Dr. Ata ur Rehman, Dr. Adeel Saqib"
13,2026-11-05,1330-1500,CPE342,Microprocessor Systems and Interfacing,BCE-V,23,Akbar Ali Khan Afridi,CR3,"Dr. Muhammad Saleem Khan, Dr. Muhammad Shahzad Faisal CS"
14,2026-11-06,1010-1140,CPE343,Computer Organization and Architecture,BCE-V,23,Ayesha Nasir,CR2,"Nazish Yameen Malak, Ayesha Nasir"
15,2026-11-07,1500-1630,CPE231,Electronic Devices and Circuits,BCE-V,5,Ihtesham Jadoon,LH1,"Dr. Ehtesham Ul Mujeeb, Dr. Muhammad Saleem Khan"
16,2026-11-09,0830-1000,CSC323,Principles of Operating Systems,BCE-V,24,Raheel Zaman,LH1,"Raheel Zaman, Dr. Muhammad Sulaiman"
17,2026-11-10,1330-1500,MTH375,Numerical Computations,BCE-V,24,Dr. Farooq Ahmed Shah,LH1,"Dr. Farooq Ahmed Shah, Dr. Tahira Sadaf"
18,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BCE-VII,26,Sanober Tariq,LH1,"Mehreen Wahab, Muhammad Fawad"
19,2026-11-05,1330-1500,CPE342,Microprocessor Systems and Interfacing,BCE-VII,1,Akbar Ali Khan Afridi,CR3,"Dr. Muhammad Saleem Khan, Dr. Muhammad Shahzad Faisal CS"
20,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BCE-VII,1,Dr. Muhammad Awais,LH2,"Kashif Jatoi, Marwa Khanam"
21,2026-11-06,1500-1630,CPE462,Artificial Intelligence,BCE-VII,26,Qazi Zia Ullah,LH5,"Qazi Zia Ullah, Fouzia Jabeen"
22,2026-11-07,0830-1000,CPE251,Probability Methods in Engineering,BCE-VII,1,Dr. Shahid Hussain,CR2,"Sadia Ejaz, Dr. Muhammad Usman Shah"
23,2026-11-07,0830-1000,HUM120,Expository Writing,BCE-VII,2,Dr.Muhammad Usman Shah,CR2,"Sadia Ejaz, Dr. Muhammad Usman Shah"
24,2026-11-07,1150-1320,MGT462,Project Planning and Management,BCE-VII,26,Sanober Tariq,LH1,"Muhammad Fahad Khan, Rabia Khatoon"
25,2026-11-07,1500-1630,CPE231,Electronic Devices and Circuits,BCE-VII,10,Ihtesham Jadoon,LH4,"Dr. Muhammad Numan, Dr. Muhammad Shahzad Faisal CS"
26,2026-11-10,1500-1630,EEE351,Principles of Communication Systems,BCE-VII,26,Dr. Shujaat Ali Khan,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
27,2026-11-04,1010-1140,CPE324,Digital Signal Processing,BCE-IX,1,Dr. Muhammad Ismail Khan,CR3,"Visiting CS Javeria Kanwal, Dr. Muhammad Ismail Khan"
28,2026-11-05,0830-1000,HUM111,Pakistan Studies,BCE-IX,2,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
29,2026-11-07,0830-1000,CPE251,Probability Methods in Engineering,BCE-IX,1,Dr. Shahid Hussain,CR2,"Sadia Ejaz, Dr. Muhammad Usman Shah"
30,2026-11-07,1500-1630,CPE325,Control Systems,BCE-IX,1,Prof. Dr. Laiq Khan,LH2,"Dr. Muhammad Yousaf Khan, Prof. Dr. Laiq Khan"
31,2026-11-09,0830-1000,EEE232,Electronics II,BCE-IX,1,Mubashir Rehman,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
32,2026-11-10,1500-1630,EEE351,Principles of Communication Systems,BCE-IX,1,Dr. Shujaat Ali Khan,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,Bachelor of Science in Computer Science,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BCS-I,50,Sanober Tariq,CR3,"Sameen Khalid, AttaUllah"
2,2026-11-05,1010-1140,HUM122,Fundamentals of Psychology,BCS-I,50,Dr. Hamid Masood,CR3,"Muhammad Qasim, Munnazza Mushtaq"
3,2026-11-05,1330-1500,HUM116,Ethics,BCS-I,1,Fouzia Jabeen,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
4,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BCS-I,50,Umar Zia,CR3,"Kamran Ali, Noor ul Ain"
5,2026-11-06,1500-1630,CSC101,Introduction to ICT,BCS-I,50,Muhammad Fawad,CR4,"Muhammad Fawad, Abdul Ahad"
6,2026-11-07,1330-1500,HUM104,Functional English,BCS-I,50,Tasneem Fiza,CR2,"Tasneem Fiza, Fouzia Jabeen"
7,2026-11-09,0830-1000,MTH091,Pre-Calculus I,BCS-I,7,Dr. Muhammad Sulaiman,LH1,"Raheel Zaman, Dr. Muhammad Sulaiman"
8,2026-11-10,0830-1000,HUM112,Islamic Studies,BCS-I,49,Aziz Ul Hassan,CR3,"AttaUllah, Sadia Ejaz"
9,2026-11-04,1500-1630,CSC102,Discrete Structures,BCS-II,48,Mehreen Wahab,LH1,"Waqas Ahmed, Dr. Aamir Ali"
10,2026-11-05,1010-1140,PHY124,Applied Physics,BCS-II,49,Dr. Muhammad Zeb,LH1,"Dr. Tahira Sadaf, Dr. Yaser Ali Shah"
11,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BCS-II,2,Umar Zia,CR3,"Kamran Ali, Noor ul Ain"
12,2026-11-06,1500-1630,CSC101,Introduction to ICT,BCS-II,1,Muhammad Fawad,CR4,"Muhammad Fawad, Abdul Ahad"
13,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BCS-II,48,Narmeen Khalid,LH1,"Narmeen khalid, Babar Shazad"
14,2026-11-07,0830-1000,HUM120,Expository Writing,BCS-II,48,Muneeba Rehman (Hybrid HUM102),CR4,"Dr. Muhammad Shahzad Faisal CS, Dr. Noor Muhammad"
15,2026-11-07,1330-1500,HUM104,Functional English,BCS-II,1,Tasneem Fiza,CR2,"Tasneem Fiza, Fouzia Jabeen"
16,2026-11-09,0830-1000,MTH092,Pre-Calculus II,BCS-II,19,Adil Ihsan,LH2,"Shehzad Rizwan, Visiting Mgt Taimoor Farooq"
17,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BCS-II,47,Dr. Muhammad Sharif,CR2,"Dr. Muhammad Sharif, Aziz Ul Hassan"
18,2026-11-10,0830-1000,HUM112,Islamic Studies,BCS-II,1,Aziz Ul Hassan,CR3,"AttaUllah, Sadia Ejaz"
19,2026-11-04,1500-1630,CSC211,Data Structures,BCS-III,57,Armughan Ali,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
20,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BCS-III,57,Syed Usman Anwar,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
21,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BCS-III,57,Dr. Maimona Rafiq,EEhall,"Tahreem Khalil, Dr. Farooq Ahmed Shah, Fayaz Ali, Fouzia Jabeen"
22,2026-11-06,1500-1630,MGT250,Introduction to Entrepreneurship,BCS-III,1,Dr. Syed Asim Shah,LH5,"Qazi Zia Ullah, Fouzia Jabeen"
23,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BCS-III,57,Dr. Ata ur Rehman,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Awais, Muhammad Waseem Khan, Dr. Noman Khan"
24,2026-11-10,1150-1320,CSC270,Database Systems,BCS-III,57,Mehreen Wahab,EEhall,"Mehreen Wahab, Dr. Ehtesham Ul Mujeeb, Dr. Hamid Masood, Dr. Midrar Ullah"
25,2026-11-04,0830-1000,EEE240,Fundamentals of Digital Logic Design,BCS-IV,51,Babar Sattar Khan,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
26,2026-11-04,1500-1630,CSC102,Discrete Structures,BCS-IV,1,Mehreen Wahab,LH1,"Waqas Ahmed, Dr. Aamir Ali"
27,2026-11-04,1500-1630,CSC211,Data Structures,BCS-IV,5,Armughan Ali,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
28,2026-11-04,1500-1630,CSC211,Data Structures,BCS-IV,1,Anam Moin,LH2,"Visiting Mgt Taimoor Farooq, Dr. Asim Anwar"
29,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BCS-IV,53,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
30,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BCS-IV,1,Syed Usman Anwar,EEhall,"Dr. Sohail Ahmad, Dr. Syed Asim Shah, Dr. Takasar Hussain, Tahreem Khalil"
31,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BCS-IV,1,Umar Zia,CR3,"Kamran Ali, Noor ul Ain"
32,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BCS-IV,5,Dr. Maimona Rafiq,EEhall,"Tahreem Khalil, Dr. Farooq Ahmed Shah, Fayaz Ali, Fouzia Jabeen"
33,2026-11-06,1150-1320,CSC210,Professional Practices,BCS-IV,53,Dr. Farman Ali Marwat,EEhall,"Muhammad Waseem Khan, Munnazza Mushtaq, Noor ul Ain, Salah Ud Din"
34,2026-11-06,1500-1630,CSC275,Computer Networks,BCS-IV,1,Shehzad Rizwan,LH5,"Qazi Zia Ullah, Fouzia Jabeen"
35,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BCS-IV,48,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
36,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BCS-IV,51,Dr. Muhammad Saleem Khan,EEhall,"Dr. Attiq Ur Rehman, Ihtesham Jadoon, Mubashir Rehman, Sania Irum"
37,2026-11-09,0830-1000,MTH092,Pre-Calculus II,BCS-IV,3,Adil Ihsan,LH2,"Shehzad Rizwan, Visiting Mgt Taimoor Farooq"
38,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BCS-IV,45,Dr. Sohail Ahmad,CR3,"Dr. Shahid Hussain, Muhammad Usman"
39,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BCS-IV,1,Dr. Muhammad Sharif,CR2,"Dr. Muhammad Sharif, Aziz Ul Hassan"
40,2026-11-10,1150-1320,CSC270,Database Systems,BCS-IV,1,Mehreen Wahab,EEhall,"Mehreen Wahab, Dr. Ehtesham Ul Mujeeb, Dr. Hamid Masood, Dr. Midrar Ullah"
41,2026-11-04,0830-1000,EEE240,Fundamentals of Digital Logic Design,BCS-V,5,Babar Sattar Khan,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
42,2026-11-04,1150-1320,AIC354,Machine Learning Fundamentals,BCS-V,50,Muhammad Qasim,EEhall,"Dr. Takasar Hussain, Imran Bashir, Kashif Jatoi, Maryam bibi"
43,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BCS-V,1,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
44,2026-11-05,1330-1500,CSC325,Computer Organization & Assembly Language,BCS-V,45,Farwida Javed,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
45,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BCS-V,1,Dr. Farooq Ahmed Shah,LH1,"Imran Bashir, Irshad Ullah"
46,2026-11-06,1150-1320,CSC210,Professional Practices,BCS-V,1,Dr. Farman Ali Marwat,EEhall,"Muhammad Waseem Khan, Munnazza Mushtaq, Noor ul Ain, Salah Ud Din"
47,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BCS-V,50,Dr. Mohammad Sardaraz,CR2,"Dr. Mohammad Sardaraz, Muhammad Fawad"
48,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BCS-V,2,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
49,2026-11-07,1010-1140,CSC303,Mobile Application Development,BCS-V,50,Marwa Khanam,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
50,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BCS-V,1,Dr. Muhammad Saleem Khan,EEhall,"Dr. Attiq Ur Rehman, Ihtesham Jadoon, Mubashir Rehman, Sania Irum"
51,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BCS-V,1,Dr. Sohail Ahmad,CR3,"Dr. Shahid Hussain, Muhammad Usman"
52,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BCS-V,49,Dr. Ali Imran,CR2,"Dr. Ali Imran, Dr. Sohail Ahmad"
53,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BCS-V,1,Dr. Ata ur Rehman,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Awais, Muhammad Waseem Khan, Dr. Noman Khan"
54,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BCS-V,1,Dr. Muhammad Sharif,CR2,"Dr. Muhammad Sharif, Aziz Ul Hassan"
55,2026-11-10,1150-1320,CSC270,Database Systems,BCS-V,1,Mehreen Wahab,EEhall,"Mehreen Wahab, Dr. Ehtesham Ul Mujeeb, Dr. Hamid Masood, Dr. Midrar Ullah"
56,2026-11-10,1150-1320,CSC336,Web Technologies,BCS-V,50,Irshad Ullah,LH1,"Dr. Muhammad Ayub, Dr. Muhammad Ismail Khan"
57,2026-11-04,0830-1000,EEE240,Fundamentals of Digital Logic Design,BCS-VI,2,Babar Sattar Khan,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
58,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BCS-VI,1,Sanober Tariq,CR3,"Sameen Khalid, AttaUllah"
59,2026-11-04,1150-1320,AIC341,Introduction to Computer Vision,BCS-VI,49,Muhammad Qasim,CR2,"Muhammad Qasim, Dr. Muhammad Usman Shah"
60,2026-11-04,1150-1320,AIC354,Machine Learning Fundamentals,BCS-VI,2,Muhammad Qasim,EEhall,"Dr. Takasar Hussain, Imran Bashir, Kashif Jatoi, Maryam bibi"
61,2026-11-04,1500-1630,CSC211,Data Structures,BCS-VI,2,Armughan Ali,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
62,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BCS-VI,1,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
63,2026-11-05,0830-1000,MTH231,Linear Algebra,BCS-VI,49,Dr. Muhammad Sulaiman,CR4,"Dr. Farman Ali Marwat, Akbar Ali Khan Afridi"
64,2026-11-05,1150-1320,CSC312,Theory of Automata,BCS-VI,48,Armughan Ali,EEhall,"Shanza Zafar, Armughan Ali, Dr. Ata ur Rehman, Dr. Adeel Saqib"
65,2026-11-05,1330-1500,CSC325,Computer Organization & Assembly Language,BCS-VI,1,Farwida Javed,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
66,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BCS-VI,1,Anam Moin,CR3,"Anam Moin, Syed Bilal Haider Bukhari"
67,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BCS-VI,1,Syed Bilal Haider Bukhari,CR3,"Anam Moin, Syed Bilal Haider Bukhari"
68,2026-11-06,1500-1630,CSC101,Introduction to ICT,BCS-VI,1,Muhammad Waseem Khan,CR3,"Shehzad Rizwan, Muhammad Waseem Khan"
69,2026-11-06,1500-1630,CSC275,Computer Networks,BCS-VI,1,Shehzad Rizwan,LH5,"Qazi Zia Ullah, Fouzia Jabeen"
70,2026-11-07,1010-1140,AIC380,Artificial Neural Networks,BCS-VI,44,Maryam Bibi,CR4,"Dr. Muhammad Ayub, Mehreen Wahab"
71,2026-11-07,1010-1140,CSC303,Mobile Application Development,BCS-VI,1,Marwa Khanam,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
72,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BCS-VI,2,Faiza Khan,CR2,"Faiza Khan, Shanza Zafar"
73,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BCS-VI,4,Salah Ud Din,CR2,"Faiza Khan, Shanza Zafar"
74,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BCS-VI,49,AttaUllah,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
75,2026-11-09,0830-1000,MTH092,Pre-Calculus II,BCS-VI,1,Adil Ihsan,LH2,"Shehzad Rizwan, Visiting Mgt Taimoor Farooq"
76,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BCS-VI,10,Dr. Sohail Ahmad,LH2,"Shehzad Rizwan, Visiting Mgt Taimoor Farooq"
77,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BCS-VI,2,Dr. Ali Imran,CR2,"Dr. Ali Imran, Dr. Sohail Ahmad"
78,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BCS-VI,1,Dr. Ata ur Rehman,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Awais, Muhammad Waseem Khan, Dr. Noman Khan"
79,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BCS-VI,1,Farwida Javed,CR2,"Waqas Ahmed, Farwida Javed"
80,2026-11-10,0830-1000,CSC412,Advance Programming / Visual Programming,BCS-VI,49,Waqas Ahmed,LH1,"Maryam bibi, Noor ul Ain"
81,2026-11-10,1150-1320,CSC270,Database Systems,BCS-VI,2,Shehzad Rizwan,CR3,"Dr. Muhammad Shahzad Faisal CS, Shehzad Rizwan"
82,2026-11-10,1150-1320,CSC336,Web Technologies,BCS-VI,1,Irshad Ullah,LH1,"Dr. Muhammad Ayub, Dr. Muhammad Ismail Khan"
83,2026-11-04,0830-1000,EEE240,Fundamentals of Digital Logic Design,BCS-VII,4,Babar Sattar Khan,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
84,2026-11-04,1500-1630,CSC441,Compiler Construction,BCS-VII,47,Armughan Ali,CR4,"Muhammad Qasim, Sadia Ejaz"
85,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BCS-VII,1,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
86,2026-11-05,1150-1320,AIC365,Natural Language Processing,BCS-VII,47,Tahreem Khalil,CR3,"Farwida Javed, Babar Sattar Khan"
87,2026-11-06,1500-1630,CSC325,Computer Organization & Assembly Language,BCS-VII,42,Syed Bilal Haider Bukhari,LH2,"Syed Bilal Haider Bukhari, Faiza Khan"
88,2026-11-07,1010-1140,AIC380,Artificial Neural Networks,BCS-VII,46,Maryam Bibi,CR2,"Maryam bibi, Babar Shazad"
89,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BCS-VII,1,Dr. Muhammad Saleem Khan,EEhall,"Dr. Attiq Ur Rehman, Ihtesham Jadoon, Mubashir Rehman, Sania Irum"
90,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BCS-VII,1,Dr. Muhammad Sharif,CR2,"Dr. Muhammad Sharif, Aziz Ul Hassan"
91,2026-11-10,1330-1500,CSC232,Information Security,BCS-VII,47,Dr. Khalid Mahmood Awan,CR2,"Dr. Khalid Mahmood Awan, Salman Yahya"
92,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BCS-VIII,2,Salman Yahya,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
93,2026-11-04,1150-1320,CSC354,Machine Learning,BCS-VIII,1,Muhammad Qasim,CR4,"Muhammad Fahad Khan, Shehzad Rizwan"
94,2026-11-04,1330-1500,MTH242,Differential Equations,BCS-VIII,5,Adil Ihsan,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
95,2026-11-04,1500-1630,CSC441,Compiler Construction,BCS-VIII,2,Armughan Ali,CR4,"Muhammad Qasim, Sadia Ejaz"
96,2026-11-05,0830-1000,MGT350,Human Resource Management,BCS-VIII,40,Dr. Ehtesham Ul Mujeeb,LH2,"Dr. Farooq Ahmed Shah, Dr. Hamid Masood"
97,2026-11-05,1150-1320,CSC312,Theory of Automata,BCS-VIII,1,Armughan Ali,EEhall,"Shanza Zafar, Armughan Ali, Dr. Ata ur Rehman, Dr. Adeel Saqib"
98,2026-11-05,1330-1500,HUM220,Introduction to Psychology,BCS-VIII,2,Dr. Hamid Masood,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
99,2026-11-05,1330-1500,HUM220,Introduction to Psychology,BCS-VIII,1,Dr. Midrar Ullah,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
100,2026-11-06,0830-1000,CSC334,Parallel and Distributed Computing,BCS-VIII,40,Kamran Ali,LH1,"Imran Bashir, Irshad Ullah"
101,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BCS-VIII,1,Dr. Mohammad Sardaraz,CR2,"Dr. Mohammad Sardaraz, Muhammad Fawad"
102,2026-11-06,1150-1320,CSC410,Professional Practices,BCS-VIII,1,Dr. Farman Ali Marwat,CR4,"Dr. Farman Ali Marwat, Kamran Ali"
103,2026-11-06,1500-1630,CSC340,Computer Networks,BCS-VIII,3,Shehzad Rizwan,CR4,"Muhammad Fawad, Abdul Ahad"
104,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BCS-VIII,1,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
105,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BCS-VIII,1,Shanza Zafar,LH2,"AttaUllah, Ayesha Nasir"
106,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BCS-VIII,5,AttaUllah,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
107,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BCS-VIII,1,Dr. Ali Imran,CR2,"Dr. Ali Imran, Dr. Sohail Ahmad"
108,2026-11-10,1010-1140,CSC418,DevOps for Cloud Computing,BCS-VIII,41,Babar Shazad,CR2,"Babar Shazad, Dr. Noman Khan"
109,2026-11-10,1330-1500,CSC432,Information Security,BCS-VIII,3,Dr. Khalid Mahmood Awan,LH1,"Dr. Farooq Ahmed Shah, Dr. Tahira Sadaf"
110,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BCS-IX,1,Salman Yahya,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
111,2026-11-04,1150-1320,CSC354,Machine Learning,BCS-IX,2,Muhammad Qasim,CR4,"Muhammad Fahad Khan, Shehzad Rizwan"
112,2026-11-04,1500-1630,CSC441,Compiler Construction,BCS-IX,2,Armughan Ali,CR4,"Muhammad Qasim, Sadia Ejaz"
113,2026-11-05,0830-1000,MGT350,Human Resource Management,BCS-IX,4,Dr. Ehtesham Ul Mujeeb,LH2,"Dr. Farooq Ahmed Shah, Dr. Hamid Masood"
114,2026-11-05,1330-1500,CSC325,Computer Organization & Assembly Language,BCS-IX,1,Farwida Javed,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
115,2026-11-06,0830-1000,CSC334,Parallel and Distributed Computing,BCS-IX,2,Kamran Ali,LH1,"Imran Bashir, Irshad Ullah"
116,2026-11-06,1150-1320,CSC410,Professional Practices,BCS-IX,1,Muhammad Fawad,CR3,"Anam Moin, Syed Bilal Haider Bukhari"
117,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BCS-IX,1,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
118,2026-11-07,1150-1320,CSC462,Artificial Intelligence,BCS-IX,1,Dr. Muhammad Saleem Khan,CR3,"Fayaz Ali, Nazish Yameen Malak"
119,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BCS-IX,1,AttaUllah,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
120,2026-11-10,1010-1140,CSC418,DevOps for Cloud Computing,BCS-IX,4,Babar Shazad,CR2,"Babar Shazad, Dr. Noman Khan"
121,2026-11-10,1330-1500,CSC432,Information Security,BCS-IX,1,Dr. Khalid Mahmood Awan,LH1,"Dr. Farooq Ahmed Shah, Dr. Tahira Sadaf"
122,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BCS-XI,1,Salman Yahya,EEhall,"Faiza Khan, Fayaz Ali, Irshad Ullah, Umar Zia"
123,2026-11-04,1330-1500,MTH242,Differential Equations,BCS-XI,1,Adil Ihsan,EEhall,"Dr. Adeel Saqib, Sania Irum, Dr. Saddam Hussain, Dr. Tahira Sadaf"
124,2026-11-05,1010-1140,PHY120,"Electricity, Magnetism and Optics",BCS-XI,1,Dr. Muhammad Zeb,CR2,"Dr. Muhammad Sharif, Dr. Muhammad Zeb"
125,2026-11-05,1330-1500,CSC321,Microprocessor and Assembly Language,BCS-XI,1,Farwida Javed,CR2,"Dr. Saddam Hussain, Akbar Ali Khan Afridi"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BEE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1150-1320,CSC101,Introduction to ICT,BEE-I,12,Abbas Ali Shah,LH1,"Dr. Muhammad Ayub, Muhammad Waseem Khan"
2,2026-11-05,1010-1140,EEE121,Electric Circuits Analysis I,BEE-I,12,Kashif Jatoi,LH2,"Dr. Shabbir Haider, Kashif Jatoi"
3,2026-11-05,1330-1500,CHM102,Introduction to Chemistry,BEE-I,1,Dr. Assad Hafiz,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
4,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BEE-I,12,Dr. Muhammad Awais,LH1,"Imran Bashir, Irshad Ullah"
5,2026-11-07,1330-1500,HUM104,Functional English,BEE-I,12,Narmeen Khalid,LH1,"Marwa Khanam, Maryam bibi"
6,2026-11-10,1010-1140,PHY124,Applied Physics,BEE-I,12,Dr. Assad Hafiz,LH2,"Fouzia Jabeen, Kamran Ali"
7,2026-11-04,0830-1000,EEE241,Digital Logic Design,BEE-III,1,Babar Sattar Khan,LH2,"Muhammad Kamran, Narmeen khalid"
8,2026-11-04,1330-1500,MTH242,Differential Equations,BEE-III,13,Dr. Muhammad Sulaiman,CR2,"Dr. Muhammad Imran Malik, Dr. Muhammad Sulaiman"
9,2026-11-05,0830-1000,MTH231,Linear Algebra,BEE-III,15,Sania Irum,LH6,"Sania Irum, Dr. Muhammad Saleem Khan"
10,2026-11-05,1150-1320,EEE241,Digital Logic Design,BEE-III,2,Farwida Javed,CR3,"Farwida Javed, Babar Sattar Khan"
11,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BEE-III,3,Tahreem Khalil,LH2,"Kashif Jatoi, Marwa Khanam"
12,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BEE-III,15,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
13,2026-11-07,0830-1000,EEE251,Probability Methods in Engineering,BEE-III,13,Dr. Shahid Hussain,LH5,"Dr. Shahid Hussain, Dr. Muhammad Yousaf Khan"
14,2026-11-07,1500-1630,EEE231,Electronics I,BEE-III,16,Ihtesham Jadoon,EEhall,"Dr. Muhammad Ozair, Ihtesham Jadoon, Babar Sattar Khan, Salah Ud Din"
15,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BEE-III,3,Dr. Sohail Ahmad,CR2,"Dr. Ali Imran, Dr. Sohail Ahmad"
16,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BEE-III,13,Raheel Zaman,LH4,"Raheel Zaman, Salah Ud Din"
17,2026-11-10,0830-1000,HUM112,Islamic Studies,BEE-III,1,Visiting Mgt Taimoor Farooq,LH2,"Rabia Khatoon, Sameen Khalid"
18,2026-11-04,1500-1630,CSC211,Data Structures,BEE-V,1,Armughan Ali,CR3,"Dr. Farman Ali Marwat, Armughan Ali"
19,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BEE-V,13,Imran Bashir,LH6,"Sania Irum, Dr. Muhammad Saleem Khan"
20,2026-11-05,1330-1500,EEE342,Microprocessor Systems and Interfacing,BEE-V,13,Akbar Ali Khan Afridi,CR2,"Dr. Saddam Hussain, Akbar Ali Khan Afridi"
21,2026-11-07,1500-1630,EEE325,Control Systems,BEE-V,12,Prof. Dr. Laiq Khan,LH2,"Dr. Muhammad Yousaf Khan, Prof. Dr. Laiq Khan"
22,2026-11-09,0830-1000,EEE232,Electronics II,BEE-V,13,Mubashir Rehman,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
23,2026-11-10,1500-1630,EEE351,Principles of Communication Systems,BEE-V,12,Dr. Ata ur Rehman,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
24,2026-11-04,1150-1320,EEE381,Power Transmission,BEE-VII,11,Babar Sattar Khan,LH2,"Babar Sattar Khan, Munnazza Mushtaq"
25,2026-11-05,1330-1500,ECO290,Fundamentals of Engineering Economics,BEE-VII,11,Dr. Farooq Ahmed Shah,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
26,2026-11-06,1010-1140,EGG101,Engineering Professionalism,BEE-VII,10,Dr. Assad Hafiz,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
27,2026-11-07,0830-1000,EEE251,Probability Methods in Engineering,BEE-VII,1,Dr. Shahid Hussain,LH5,"Dr. Shahid Hussain, Dr. Muhammad Yousaf Khan"
28,2026-11-07,1330-1500,EEE435,Industrial Electronics,BEE-VII,11,Yasir Muhammad,LH1,"Marwa Khanam, Maryam bibi"
29,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BEE-VII,1,Raheel Zaman,LH4,"Raheel Zaman, Salah Ud Din"
30,2026-11-10,1500-1630,EEE351,Principles of Communication Systems,BEE-VII,1,Dr. Ata ur Rehman,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Ozair, Abdul Ahad, Sameen Khalid"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BEN,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1150-1320,ENG253,Phonetics and Phonology,BEN-III,13,Dr. Muhammad Ayub,LH1,"Dr. Muhammad Ayub, Muhammad Waseem Khan"
2,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BEN-III,13,Imran Bashir,LH1,"Dr. Ata ur Rehman, Dr. Attiq Ur Rehman"
3,2026-11-06,1010-1140,ENG251,Classical and Neo Classical Poetry,BEN-III,13,Dr. Muhammad Yousaf Khan,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
4,2026-11-06,1330-1500,HUM161,Understanding of Holy Quran – I (Fehm-e-Quran–I),BEN-III,13,Visiting Mgt Taimoor Farooq,EEhall,"Visiting Mgt Taimoor Farooq, Dr. Assad Hafiz, Nazish Yameen Malak, Shanza Zafar"
5,2026-11-07,0830-1000,HUM120,Expository Writing,BEN-III,13,Dr. Muhammad Yousaf Khan,LH5,"Dr. Shahid Hussain, Dr. Muhammad Yousaf Khan"
6,2026-11-10,1010-1140,PHY124,Applied Physics,BEN-III,13,Dr. Saeed Ehsan Awan,LH2,"Fouzia Jabeen, Kamran Ali"
7,2026-11-04,1500-1630,CMS431,Social Media Production,BEN-V,11,Salman Yahya,LH5,"Dr. Sadaf Yasmin, Dr. Saeed Ehsan Awan"
8,2026-11-05,1010-1140,ENG205,Modern Poetry,BEN-V,11,Dr. Muhammad Yousaf Khan,LH5,"Mubashir Rehman, Muhammad Fahad Khan"
9,2026-11-06,1010-1140,CMS307,Current Affairs,BEN-V,11,Dr. Muhammad Imran Malik,EEhall,"Narmeen khalid, Akbar Ali Khan Afridi, Armughan Ali, Rabia Khatoon"
10,2026-11-07,1010-1140,ENG408,Computer Assisted Language Learning,BEN-V,11,Dr. Muhammad Ayub,CR4,"Dr. Muhammad Ayub, Mehreen Wahab"
11,2026-11-10,1010-1140,ENG352,Literary Stylistics,BEN-V,11,Tasneem Fiza,LH1,"Tasneem Fiza, Ayesha Nasir"
12,2026-11-04,1500-1630,CMS431,Social Media Production,BEN-VI,6,Salman Yahya,LH2,"Visiting Mgt Taimoor Farooq, Dr. Asim Anwar"
13,2026-11-05,1010-1140,ENG205,Modern Poetry,BEN-VI,6,Dr. Muhammad Yousaf Khan,LH4,"Dr. Muhammad Yousaf Khan, Ihtesham Jadoon"
14,2026-11-06,1010-1140,CMS307,Current Affairs,BEN-VI,6,Dr. Muhammad Imran Malik,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
15,2026-11-07,1010-1140,ENG408,Computer Assisted Language Learning,BEN-VI,6,Dr. Muhammad Ayub,LH2,"Raheel Zaman, Syed Bilal Haider Bukhari"
16,2026-11-07,1500-1630,ENG451,Teaching of Literature,BEN-VI,6,Dr. Muhammad Yousaf Khan,LH2,"Dr. Muhammad Yousaf Khan, Prof. Dr. Laiq Khan"
17,2026-11-09,0830-1000,ENG404,Semantics and Lexical Studies,BEN-VI,6,Dr. Muhammad Ayub,LH2,"Shehzad Rizwan, Visiting Mgt Taimoor Farooq"
18,2026-11-04,1500-1630,CMS431,Social Media Production,BEN-VII,16,Salman Yahya,LH2,"Visiting Mgt Taimoor Farooq, Dr. Asim Anwar"
19,2026-11-05,1010-1140,ENG205,Modern Poetry,BEN-VII,16,Dr. Muhammad Yousaf Khan,LH4,"Dr. Muhammad Yousaf Khan, Ihtesham Jadoon"
20,2026-11-06,1010-1140,CMS307,Current Affairs,BEN-VII,16,Dr. Muhammad Imran Malik,CR3,"Dr. Muhammad Imran Malik, Dr. Assad Hafiz"
21,2026-11-07,1010-1140,ENG408,Computer Assisted Language Learning,BEN-VII,16,Dr. Muhammad Ayub,LH2,"Raheel Zaman, Syed Bilal Haider Bukhari"
22,2026-11-07,1500-1630,ENG451,Teaching of Literature,BEN-VII,16,Dr. Muhammad Yousaf Khan,LH2,"Dr. Muhammad Yousaf Khan, Prof. Dr. Laiq Khan"
23,2026-11-09,0830-1000,ENG404,Semantics and Lexical Studies,BEN-VII,16,Dr. Muhammad Ayub,LH2,"Shehzad Rizwan, Visiting Mgt Taimoor Farooq"
24,2026-11-10,0830-1000,HUM112,Islamic Studies,BEN-VII,1,Aziz Ul Hassan,CR2,"Dr. Muhammad Sharif, Aziz Ul Hassan"
25,2026-11-04,1500-1630,PSY503,Media Communication,BEN-VIII,8,Salman Yahya,LH5,
26,2026-11-05,0830-1000,HUM111,Pakistan Studies,BEN-VIII,1,Imran Bashir,EEhall,"Dr. Muhammad Usman Shah, Babar Sattar Khan, Dr. Adeel Saqib, Dr. Ali Imran"
27,2026-11-07,1010-1140,ENG408,Computer Assisted Language Learning,BEN-VIII,8,Dr. Muhammad Ayub,LH2,"Raheel Zaman, Syed Bilal Haider Bukhari"
28,2026-11-10,1010-1140,ENG352,Literary Stylistics,BEN-VIII,8,Tasneem Fiza,LH1,"Tasneem Fiza, Ayesha Nasir"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BMD,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1010-1140,CSC101,Introduction to ICT,BMD-I,14,Adil Ihsan,EEhall,"Akbar Ali Khan Afridi, Fouzia Jabeen, Waqas Ahmed, Syed Bilal Haider Bukhari"
2,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BMD-I,10,Dr. Aamir Ali,LH4,"Dr. Aamir Ali, Maryam bibi"
3,2026-11-07,1330-1500,HUM104,Functional English,BMD-I,14,Narmeen Khalid,LH1,"Marwa Khanam, Maryam bibi"
4,2026-11-09,0830-1000,MTH091,Pre-Calculus I,BMD-I,4,Dr. Muhammad Sulaiman,LH5,"Kamran Ali, Marwa Khanam"
5,2026-11-09,1150-1320,MTH103,Exploring Quantitative Skills,BMD-I,14,Dr. Muhammad Awais,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Awais, Muhammad Waseem Khan, Dr. Noman Khan"
6,2026-11-10,0830-1000,HUM112,Islamic Studies,BMD-I,14,Aziz Ul Hassan,LH4,"Raheel Zaman, Salah Ud Din"
7,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BMD-III,13,Sanober Tariq,LH2,"Muhammad Kamran, Narmeen khalid"
8,2026-11-05,1330-1500,MTH241,Ordinary Differential Equations,BMD-III,12,Dr. Aamir Ali,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
9,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BMD-III,1,Dr. Aamir Ali,LH4,"Dr. Aamir Ali, Maryam bibi"
10,2026-11-06,1150-1320,MTH114,Tools for Quantitative Reasoning,BMD-III,13,Dr. Asif Waheed,EEhall,"Muhammad Waseem Khan, Munnazza Mushtaq, Noor ul Ain, Salah Ud Din"
11,2026-11-07,0830-1000,HUM120,Expository Writing,BMD-III,13,Muneeba Rehman (Hybrid HUM102),"CR4, CR3","Shanza Zafar, Dr. Muhammad Awais; Dr. Muhammad Shahzad Faisal CS, Dr. Noor Muhammad"
12,2026-11-09,0830-1000,MTH262,Statistics and Probability Theory,BMD-III,13,Dr. Shahid Hussain,LH5,"Kamran Ali, Marwa Khanam"
13,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BMD-III,13,Raheel Zaman,LH4,"Raheel Zaman, Salah Ud Din"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,Bachelor of Science in Software Engineering,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BSE-I,55,Sanober Tariq,CR2,"Sanober Tariq, Rabia Khatoon"
2,2026-11-05,1010-1140,HUM122,Fundamentals of Psychology,BSE-I,55,Dr. Hamid Masood,EEhall,"Muhammad Usman, Umar Zia, Raheel Zaman"
3,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BSE-I,55,Umar Zia,CR2,"Umar Zia, Babar Shazad"
4,2026-11-06,1500-1630,CSC101,Introduction to ICT,BSE-I,55,Muhammad Waseem Khan,EEhall,"Dr. Ali Imran, AttaUllah, Ayesha Nasir, Anam Moin"
5,2026-11-07,1330-1500,HUM104,Functional English,BSE-I,55,Narmeen Khalid,EEhall,"Imran Bashir, Irshad Ullah, Kashif Jatoi, Abdul Ahad"
6,2026-11-09,0830-1000,MTH091,Pre-Calculus I,BSE-I,6,Dr. Muhammad Sulaiman,LH4,"Imran Bashir, Irshad Ullah"
7,2026-11-10,0830-1000,HUM112,Islamic Studies,BSE-I,55,Aziz Ul Hassan,EEhall,"Dr. Muhammad Usman Shah, Fayaz Ali, Kashif Jatoi, Marwa Khanam"
8,2026-11-04,0830-1000,HUM208,Civics and Community Engagement,BSE-II,2,Sanober Tariq,,
9,2026-11-04,1500-1630,CSC102,Discrete Structures,BSE-II,49,Munnazza Mushtaq,CR2,"Munnazza Mushtaq, Mehreen Wahab"
10,2026-11-05,1010-1140,HUM122,Fundamentals of Psychology,BSE-II,2,Dr. Hamid Masood,EEhall,"Muhammad Usman, Umar Zia, Raheel Zaman"
11,2026-11-05,1010-1140,PHY124,Applied Physics,BSE-II,49,Dr. Muhammad Zeb,CR4,"Rabia Khatoon, Sanober Tariq"
12,2026-11-06,0830-1000,CSC103,Programming Fundamentals,BSE-II,2,Umar Zia,,
13,2026-11-06,1150-1320,CSC210,Professional Practices,BSE-II,48,Muhammad Fawad,CR3,"Anam Moin, Syed Bilal Haider Bukhari"
14,2026-11-06,1500-1630,CSC101,Introduction to ICT,BSE-II,4,Muhammad Waseem Khan,EEhall,"Dr. Ali Imran, AttaUllah, Ayesha Nasir, Anam Moin"
15,2026-11-07,0830-1000,HUM120,Expository Writing,BSE-II,47,Muneeba Rehman (Hybrid HUM102),LH1,"Abbas Ali Shah, Anam Moin"
16,2026-11-07,1330-1500,HUM104,Functional English,BSE-II,2,Narmeen Khalid,EEhall,"Imran Bashir, Irshad Ullah, Kashif Jatoi, Abdul Ahad"
17,2026-11-07,1330-1500,HUM104,Functional English,BSE-II,1,Tasneem Fiza,EEhall,"Imran Bashir, Irshad Ullah, Kashif Jatoi, Abdul Ahad"
18,2026-11-09,0830-1000,MTH092,Pre-Calculus II,BSE-II,12,Adil Ihsan,LH5,"Kamran Ali, Marwa Khanam"
19,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BSE-II,49,Farwida Javed,CR3,"Muhammad Kamran, Muhammad Qasim"
20,2026-11-10,0830-1000,CSC241,Object Oriented Programming,BSE-II,49,Muhammad Waseem Khan,CR4,"Muhammad Waseem Khan, Waqas Ahmed"
21,2026-11-10,0830-1000,HUM112,Islamic Studies,BSE-II,2,Aziz Ul Hassan,EEhall,"Dr. Muhammad Usman Shah, Fayaz Ali, Kashif Jatoi, Marwa Khanam"
22,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BSE-III,50,Dr. Muazzam Maqsood,CR2,"Dr. Muhammad Yousaf Khan, Dr. Muhammad Zeb"
23,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BSE-III,50,Dr. Ali Imran,CR4,"Dr. Ali Imran, Faiza Khan"
24,2026-11-06,1500-1630,CSC275,Computer Networks,BSE-III,50,Shehzad Rizwan,CR3,"Shehzad Rizwan, Muhammad Waseem Khan"
25,2026-11-07,0830-1000,HUM120,Expository Writing,BSE-III,1,Muneeba Rehman (Hybrid HUM102),LH1,"Abbas Ali Shah, Anam Moin"
26,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BSE-III,50,Farwida Javed,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Awais, Muhammad Waseem Khan, Dr. Noman Khan"
27,2026-11-10,1150-1320,CSC270,Database Systems,BSE-III,50,Dr. Muhammad Shahzad Faisal CS,CR3,"Dr. Muhammad Shahzad Faisal CS, Shehzad Rizwan"
28,2026-11-04,1500-1630,CSC211,Data Structures,BSE-IV,49,Anam Moin,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
29,2026-11-05,0830-1000,HUM113,Ideology and Constitution of Pakistan,BSE-IV,49,Imran Bashir,CR3,"Imran Bashir, Salman Yahya"
30,2026-11-05,1500-1630,CSC291,Software Engineering Concepts,BSE-IV,1,Dr. Muazzam Maqsood,CR2,"Dr. Muhammad Yousaf Khan, Dr. Muhammad Zeb"
31,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BSE-IV,12,Dr. Ali Imran,LH4,"Dr. Aamir Ali, Maryam bibi"
32,2026-11-06,1150-1320,CSC210,Professional Practices,BSE-IV,41,Dr. Farman Ali Marwat,LH2,"Sameen Khalid, Sania Irum"
33,2026-11-06,1500-1630,CSC275,Computer Networks,BSE-IV,2,Shehzad Rizwan,CR3,"Shehzad Rizwan, Muhammad Waseem Khan"
34,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BSE-IV,49,Shanza Zafar,CR3,"Shanza Zafar, Dr. Muhammad Awais"
35,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BSE-IV,47,Faiza Khan,CR2,"Faiza Khan, Shanza Zafar"
36,2026-11-09,1150-1320,EEE240,Fundamentals of Digital Logic Design,BSE-IV,3,Farwida Javed,EEhall,"Dr. Ata ur Rehman, Dr. Muhammad Awais, Muhammad Waseem Khan, Dr. Noman Khan"
37,2026-11-10,1150-1320,CSC270,Database Systems,BSE-IV,1,Dr. Muhammad Shahzad Faisal CS,CR3,"Dr. Muhammad Shahzad Faisal CS, Shehzad Rizwan"
38,2026-11-10,1330-1500,CSC232,Information Security,BSE-IV,49,Dr. Yaser Ali Shah,EEhall,"Dr. Yaser Ali Shah, Dr. Muhammad Zeb, Dr. Shahid Hussain, Dr. Syed Asim Shah"
39,2026-11-04,1010-1140,CSC325,Computer Organization & Assembly Language,BSE-V,54,Akbar Ali Khan Afridi,EEhall,"Akbar Ali Khan Afridi, Fouzia Jabeen, Waqas Ahmed, Syed Bilal Haider Bukhari"
40,2026-11-04,1500-1630,CSC211,Data Structures,BSE-V,5,Anam Moin,EEhall,"Anam Moin, Salman Yahya, Tahreem Khalil, Umar Zia"
41,2026-11-05,1010-1140,PHY124,Applied Physics,BSE-V,1,Dr. Muhammad Zeb,CR4,"Rabia Khatoon, Sanober Tariq"
42,2026-11-05,1330-1500,AIC354,Machine Learning Fundamentals,BSE-V,56,Dr. Tahira Sadaf,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
43,2026-11-06,1150-1320,CSC210,Professional Practices,BSE-V,2,Muhammad Fawad,CR3,"Anam Moin, Syed Bilal Haider Bukhari"
44,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BSE-V,56,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
45,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BSE-V,1,Faiza Khan,CR2,"Faiza Khan, Shanza Zafar"
46,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BSE-V,56,Dr. Takasar Hussain,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
47,2026-11-10,1150-1320,CSC336,Web Technologies,BSE-V,56,Faiza Khan,CR2,"Faiza Khan, Waqas Ahmed"
48,2026-11-04,0830-1000,EEE240,Fundamentals of Digital Logic Design,BSE-VI,1,Babar Sattar Khan,CR3,"Sameen Khalid, AttaUllah"
49,2026-11-04,1010-1140,CSC325,Computer Organization & Assembly Language,BSE-VI,1,Akbar Ali Khan Afridi,EEhall,"Akbar Ali Khan Afridi, Fouzia Jabeen, Waqas Ahmed, Syed Bilal Haider Bukhari"
50,2026-11-04,1150-1320,AIC354,Machine Learning Fundamentals,BSE-VI,47,Dr. Muazzam Maqsood,CR3,"Ihtesham Jadoon, Mubashir Rehman"
51,2026-11-04,1500-1630,CSC102,Discrete Structures,BSE-VI,2,Munnazza Mushtaq,CR2,"Munnazza Mushtaq, Mehreen Wahab"
52,2026-11-04,1500-1630,CSC102,Discrete Structures,BSE-VI,2,Mehreen Wahab,CR2,"Munnazza Mushtaq, Mehreen Wahab"
53,2026-11-05,0830-1000,MTH231,Linear Algebra,BSE-VI,46,Dr. Takasar Hussain,LH1,"Dr. Ata ur Rehman, Dr. Attiq Ur Rehman"
54,2026-11-05,1330-1500,AIC354,Machine Learning Fundamentals,BSE-VI,2,Dr. Tahira Sadaf,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
55,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BSE-VI,47,Anam Moin,CR4,"Dr. Farman Ali Marwat, Kamran Ali"
56,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BSE-VI,2,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
57,2026-11-07,1010-1140,CSC303,Mobile Application Development,BSE-VI,47,Marwa Khanam,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
58,2026-11-07,1150-1320,CSC262,Artificial Intelligence,BSE-VI,1,Faiza Khan,CR2,"Faiza Khan, Shanza Zafar"
59,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BSE-VI,2,Dr. Takasar Hussain,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
60,2026-11-09,1150-1320,CSE325,Software Construction and Development,BSE-VI,47,Waqas Ahmed,CR2,"Waqas Ahmed, Farwida Javed"
61,2026-11-10,1150-1320,CSC270,Database Systems,BSE-VI,2,Dr. Muhammad Shahzad Faisal CS,CR3,"Dr. Muhammad Shahzad Faisal CS, Shehzad Rizwan"
62,2026-11-10,1150-1320,CSC336,Web Technologies,BSE-VI,2,Faiza Khan,,
63,2026-11-04,1010-1140,CSC325,Computer Organization & Assembly Language,BSE-VII,5,Akbar Ali Khan Afridi,EEhall,"Akbar Ali Khan Afridi, Fouzia Jabeen, Waqas Ahmed, Syed Bilal Haider Bukhari"
64,2026-11-04,1150-1320,AIC354,Machine Learning Fundamentals,BSE-VII,1,Dr. Muazzam Maqsood,CR3,"Ihtesham Jadoon, Mubashir Rehman"
65,2026-11-04,1500-1630,CSC365,HCI and Computer Graphics,BSE-VII,53,Dr. Farman Ali Marwat,CR3,"Dr. Farman Ali Marwat, Armughan Ali"
66,2026-11-05,0830-1000,MTH231,Linear Algebra,BSE-VII,16,Dr. Takasar Hussain,CR7,"Dr. Takasar Hussain, Armughan Ali"
67,2026-11-05,1150-1320,CSE494,Software Project Management,BSE-VII,53,Shanza Zafar,EEhall,"Shanza Zafar, Armughan Ali, Dr. Ata ur Rehman, Dr. Adeel Saqib"
68,2026-11-05,1330-1500,AIC354,Machine Learning Fundamentals,BSE-VII,1,Dr. Tahira Sadaf,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
69,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BSE-VII,1,Dr. Farooq Ahmed Shah,EEhall,"Tahreem Khalil, Dr. Farooq Ahmed Shah, Fayaz Ali, Fouzia Jabeen"
70,2026-11-06,1150-1320,CSC210,Professional Practices,BSE-VII,3,Dr. Farman Ali Marwat,LH2,"Sameen Khalid, Sania Irum"
71,2026-11-06,1150-1320,CSC301,Design and Analysis of Algorithms,BSE-VII,1,Anam Moin,CR4,"Dr. Farman Ali Marwat, Kamran Ali"
72,2026-11-06,1500-1630,CSC275,Computer Networks,BSE-VII,2,Shehzad Rizwan,CR3,"Shehzad Rizwan, Muhammad Waseem Khan"
73,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BSE-VII,1,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
74,2026-11-07,1010-1140,CSC303,Mobile Application Development,BSE-VII,1,Marwa Khanam,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
75,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BSE-VII,46,AttaUllah,CR3,"Umar Zia, Aziz Ul Hassan"
76,2026-11-09,0830-1000,MTH105,Multivariable Calculus,BSE-VII,1,Dr. Takasar Hussain,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
77,2026-11-09,1150-1320,CSE325,Software Construction and Development,BSE-VII,1,Waqas Ahmed,CR2,"Waqas Ahmed, Farwida Javed"
78,2026-11-10,1010-1140,CSC418,DevOps for Cloud Computing,BSE-VII,53,Muhammad Kamran,EEhall,"Muhammad Kamran, Adil Ihsan, Sanober Tariq, Abdul Ahad"
79,2026-11-10,1150-1320,CSC336,Web Technologies,BSE-VII,1,Faiza Khan,CR2,"Faiza Khan, Waqas Ahmed"
80,2026-11-10,1330-1500,CSC232,Information Security,BSE-VII,8,Dr. Yaser Ali Shah,EEhall,"Dr. Yaser Ali Shah, Dr. Muhammad Zeb, Dr. Shahid Hussain, Dr. Syed Asim Shah"
81,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BSE-VIII,46,Salman Yahya,CR4,"Salman Yahya, Babar Shazad"
82,2026-11-05,0830-1000,MGT350,Human Resource Management,BSE-VIII,46,Dr. Ehtesham Ul Mujeeb,CR2,"Dr. Ehtesham Ul Mujeeb, Dr. Muhammad Sulaiman"
83,2026-11-05,1330-1500,CSC356,Human Computer Interaction,BSE-VIII,1,Dr. Farman Ali Marwat,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
84,2026-11-05,1330-1500,CSE305,Software Requirement Engineering,BSE-VIII,1,Dr. Yaser Ali Shah,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
85,2026-11-05,1330-1500,MTH467,Operations Research,BSE-VIII,3,Dr. Aamir Ali,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
86,2026-11-06,0830-1000,MTH104,Calculus and Analytic Geometry,BSE-VIII,1,Dr. Ali Imran,CR4,"Dr. Ali Imran, Faiza Khan"
87,2026-11-06,1150-1320,CSC410,Professional Practices,BSE-VIII,2,Muhammad Fawad,CR3,"Anam Moin, Syed Bilal Haider Bukhari"
88,2026-11-06,1150-1320,CSE302,Software Quality Engineering,BSE-VIII,3,Muhammad Fawad,CR2,"Dr. Mohammad Sardaraz, Muhammad Fawad"
89,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BSE-VIII,2,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
90,2026-11-07,1010-1140,CSC303,Mobile Application Development,BSE-VIII,1,Marwa Khanam,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
91,2026-11-07,1150-1320,CSC462,Artificial Intelligence,BSE-VIII,1,Faiza Khan,CR4,"Sameen Khalid, Sanober Tariq"
92,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BSE-VIII,1,AttaUllah,CR3,"Umar Zia, Aziz Ul Hassan"
93,2026-11-09,0830-1000,CSC456,Stochastic Processes,BSE-VIII,46,Dr. Attiq Ur Rehman,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
94,2026-11-09,1150-1320,CSE325,Software Construction and Development,BSE-VIII,1,Waqas Ahmed,CR2,"Waqas Ahmed, Farwida Javed"
95,2026-11-10,0830-1000,CSC412,Advance Programming / Visual Programming,BSE-VIII,4,Waqas Ahmed,CR4,"Muhammad Waseem Khan, Waqas Ahmed"
96,2026-11-10,0830-1000,HUM110,Islamic Studies,BSE-VIII,1,Dr. Muhammad Shahzad Faisal CS,LH2,"Rabia Khatoon, Sameen Khalid"
97,2026-11-10,1330-1500,CSC454,Pattern Recognition,BSE-VIII,45,Dr. Yaser Ali Shah,EEhall,"Dr. Yaser Ali Shah, Dr. Muhammad Zeb, Dr. Shahid Hussain, Dr. Syed Asim Shah"
98,2026-11-04,0830-1000,MGT210,Fundamentals of Marketing,BSE-IX,4,Salman Yahya,CR4,"Salman Yahya, Babar Shazad"
99,2026-11-04,1500-1630,CSC102,Discrete Structures,BSE-IX,1,Munnazza Mushtaq,CR2,"Munnazza Mushtaq, Mehreen Wahab"
100,2026-11-05,0830-1000,MGT350,Human Resource Management,BSE-IX,4,Dr. Ehtesham Ul Mujeeb,CR2,"Dr. Ehtesham Ul Mujeeb, Dr. Muhammad Sulaiman"
101,2026-11-05,1330-1500,CSC356,Human Computer Interaction,BSE-IX,1,Dr. Farman Ali Marwat,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
102,2026-11-05,1330-1500,MTH467,Operations Research,BSE-IX,1,Dr. Aamir Ali,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
103,2026-11-06,1150-1320,CSC410,Professional Practices,BSE-IX,1,Dr. Farman Ali Marwat,CR4,"Dr. Farman Ali Marwat, Kamran Ali"
104,2026-11-07,0830-1000,CSC323,Principles of Operating Systems,BSE-IX,1,Dr. Khalid Mahmood Awan,EEhall,"Dr. Khalid Mahmood Awan, Dr. Sohail Ahmad, Dr. Yaser Ali Shah, Tasneem Fiza"
105,2026-11-07,1010-1140,CSC303,Mobile Application Development,BSE-IX,1,Marwa Khanam,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
106,2026-11-07,1150-1320,CSC462,Artificial Intelligence,BSE-IX,1,Faiza Khan,CR4,"Sameen Khalid, Sanober Tariq"
107,2026-11-07,1500-1630,MTH262,Statistics and Probability Theory,BSE-IX,1,AttaUllah,CR3,"Umar Zia, Aziz Ul Hassan"
108,2026-11-09,0830-1000,CSC456,Stochastic Processes,BSE-IX,7,Dr. Attiq Ur Rehman,EEhall,"Dr. Takasar Hussain, Dr. Attiq Ur Rehman, Mubashir Rehman"
109,2026-11-10,0830-1000,CSC412,Advance Programming / Visual Programming,BSE-IX,2,Waqas Ahmed,CR4,"Muhammad Waseem Khan, Waqas Ahmed"
110,2026-11-10,1010-1140,CSC418,DevOps for Cloud Computing,BSE-IX,1,Muhammad Kamran,EEhall,"Muhammad Kamran, Adil Ihsan, Sanober Tariq, Abdul Ahad"
111,2026-11-10,1150-1320,CSC270,Database Systems,BSE-IX,1,Shehzad Rizwan,CR4,"Irshad Ullah, Dr. Attiq Ur Rehman"
112,2026-11-10,1330-1500,CSC454,Pattern Recognition,BSE-IX,4,Dr. Yaser Ali Shah,EEhall,"Dr. Yaser Ali Shah, Dr. Muhammad Zeb, Dr. Shahid Hussain, Dr. Syed Asim Shah"
113,2026-11-04,1500-1630,CSC102,Discrete Structures,BSE-X,1,Munnazza Mushtaq,CR2,"Munnazza Mushtaq, Mehreen Wahab"
114,2026-11-05,1330-1500,CSC354,Machine Learning,BSE-X,1,Dr. Tahira Sadaf,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
115,2026-11-05,1330-1500,MTH467,Operations Research,BSE-X,1,Dr. Aamir Ali,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,BSM,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1150-1320,MTH321,Real Analysis I,BSM-V,7,Dr. Takasar Hussain,EEhall,"Dr. Takasar Hussain, Imran Bashir, Kashif Jatoi, Maryam bibi"
2,2026-11-05,0830-1000,MTH231,Linear Algebra,BSM-V,2,Dr. Muhammad Sulaiman,CR2,"Dr. Ehtesham Ul Mujeeb, Dr. Muhammad Sulaiman"
3,2026-11-06,1010-1140,MTH352,Differential Geometry,BSM-V,7,Dr. Muhammad Ozair,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
4,2026-11-07,1500-1630,MTH327,Functional Analysis,BSM-V,7,Dr. Muhammad Numan,LH4,"Dr. Muhammad Numan, Dr. Muhammad Shahzad Faisal CS"
5,2026-11-09,0830-1000,STA365,Mathematical Statistics,BSM-V,7,Dr. Shahid Hussain,CR3,"Dr. Shahid Hussain, Muhammad Usman"
6,2026-11-10,1330-1500,MTH375,Numerical Computations,BSM-V,7,Dr. Farooq Ahmed Shah,LH1,"Dr. Farooq Ahmed Shah, Dr. Tahira Sadaf"
7,2026-11-04,1150-1320,MTH435,Analytical Number Theory,BSM-VII,14,Dr. Muhammad Numan,EEhall,"Dr. Takasar Hussain, Imran Bashir, Kashif Jatoi, Maryam bibi"
8,2026-11-05,1330-1500,MTH467,Operations Research,BSM-VII,14,Dr. Aamir Ali,EEhall,"Dr. Tahira Sadaf, Dr. Assad Hafiz, Dr. Muhammad Sharif"
9,2026-11-06,1010-1140,MTH352,Differential Geometry,BSM-VII,1,Dr. Muhammad Ozair,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
10,2026-11-07,1150-1320,CSC462,Artificial Intelligence,BSM-VII,14,Dr. Attiq Ur Rehman,EEhall,"Dr. Attiq Ur Rehman, Ihtesham Jadoon, Mubashir Rehman, Sania Irum"
11,2026-11-07,1500-1630,MTH327,Functional Analysis,BSM-VII,2,Dr. Muhammad Numan,LH4,"Dr. Muhammad Numan, Dr. Muhammad Shahzad Faisal CS"
12,2026-11-10,1150-1320,MTH486,Fluid Mechanics,BSM-VII,14,Dr. Muhammad Awais,LH2,"Dr. Muhammad Awais, Dr. Muhammad Ozair"
13,2026-11-04,1010-1140,MTH344,Special Functions,BSM-IX,1,Dr. Aamir Ali,CR4,"Dr. Midrar Ullah, Adil Ihsan"
14,2026-11-05,1330-1500,MTH480,Introductory Quantum Mechanics,BSM-IX,1,Dr. Muhammad Numan,CR4,"Dr. Aamir Ali, Dr. Hamid Masood"
15,2026-11-06,1010-1140,MTH465,Topics in Scientific Computing,BSM-IX,1,Dr. Asif Waheed,CR4,"Dr. Syed Asim Shah, Dr. Asim Anwar"
16,2026-11-07,1010-1140,MTH423,Advanced Complex Analysis,BSM-IX,1,Dr. Muhammad Awais,EEhall,"Marwa Khanam, Dr. Faisal Nawaz Mir, Dr. Asim Anwar, Noor ul Ain"
17,2026-11-07,1500-1630,MTH327,Functional Analysis,BSM-IX,1,Dr. Muhammad Numan,LH4,"Dr. Muhammad Numan, Dr. Muhammad Shahzad Faisal CS"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,PCE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),PCE-III,2,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,PCS,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM851,Advanced Understanding of Holy Quran -I (Fehm-e-Quran-I),PCS-I,3,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-06,1700-1830,PCS834,Special Topics in Artificial Intelligence,PCS-I,3,Dr. Sadaf Yasmin,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
3,2026-11-07,1700-1830,PCS828,Special Topics in Natural Language Processing,PCS-I,3,Dr. Muhammad Shahzad Faisal CS,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
4,2026-11-10,1700-1830,PCS875,Special Topics in Privacy and Security in IoT,PCS-I,3,Dr. Muhammad Saleem Khan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
5,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),PCS-II,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
6,2026-11-06,1700-1830,PCS834,Special Topics in Artificial Intelligence,PCS-II,1,Dr. Sadaf Yasmin,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
7,2026-11-07,1700-1830,PCS828,Special Topics in Natural Language Processing,PCS-II,1,Dr. Muhammad Shahzad Faisal CS,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
8,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),PCS-III,3,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
9,2026-11-06,1700-1830,PCS807,Special Topics in Computer Networks,PCS-III,1,Muhammad Fahad Khan,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
10,2026-11-06,1700-1830,PCS848,Special Topics in Data Mining,PCS-III,2,Dr. Sadaf Yasmin,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,PEE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM851,Advanced Understanding of Holy Quran -I (Fehm-e-Quran-I),PEE-I,3,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,EPE860,Advanced Topics in Renewable Energy,PEE-I,4,Dr. Assad Hafiz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-06,1700-1830,EPE726,Computer Methods in Power System Analysis,PEE-I,4,Yasir Muhammad,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
4,2026-11-10,1700-1830,EEE691,Independent Studies-I,PEE-I,2,Dr. Ata ur Rehman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
5,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),PEE-III,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
6,2026-11-06,1700-1830,EEE900,PhD Thesis,PEE-V,1,Yasir Muhammad,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,PMT,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM851,Advanced Understanding of Holy Quran -I (Fehm-e-Quran-I),PMT-I,2,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,MTH722,Mathematical Analysis,PMT-I,2,Dr. Sohail Ahmad,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-06,1700-1830,MTH782,Non-Newtonian Fluid Mechanics,PMT-I,2,Dr. Muhammad Zeb,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
4,2026-11-07,1700-1830,MTH702,Optimization Theory,PMT-I,2,Dr. Asif Waheed,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
5,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),PMT-II,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
6,2026-11-05,1700-1830,MTH722,Mathematical Analysis,PMT-II,1,Dr. Sohail Ahmad,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
7,2026-11-10,1700-1830,MTH709,Advanced Partial Differential Equations,PMT-II,1,Dr. Noor Muhammad,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
8,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),PMT-III,6,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
9,2026-11-05,1700-1830,MTH722,Mathematical Analysis,PMT-III,1,Dr. Sohail Ahmad,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
10,2026-11-10,1700-1830,MTH709,Advanced Partial Differential Equations,PMT-III,1,Dr. Noor Muhammad,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
11,2026-11-06,1700-1830,MTH900,Thesis,PMT-IV,2,Dr. Farooq Ahmed Shah,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
12,2026-11-06,1700-1830,MTH900,Thesis,PMT-V,2,Dr. Farooq Ahmed Shah,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,RAE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM701,Understanding of Holy Quran -1 (Fehm-e-Quran-1),RAE-I,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,EEE621,Modeling and Simulation,RAE-I,1,Dr. Mohammad Sardaraz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-07,1700-1830,ECI670,Neural and Fuzzy Systems,RAE-I,1,Dr. Muhammad Ismail Khan,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
4,2026-11-10,1700-1830,EEE610,Engineering Mathematics,RAE-I,1,Dr. Saeed Ehsan Awan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
5,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RAE-II,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
6,2026-11-05,1700-1830,EEE621,Modeling and Simulation,RAE-II,1,Dr. Mohammad Sardaraz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
7,2026-11-07,1700-1830,ECI670,Neural and Fuzzy Systems,RAE-II,1,Dr. Muhammad Ismail Khan,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
8,2026-11-10,1700-1830,EEE610,Engineering Mathematics,RAE-II,1,Dr. Saeed Ehsan Awan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,RCE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM701,Understanding of Holy Quran -1 (Fehm-e-Quran-1),RCE-I,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,EEE621,Modeling and Simulation,RCE-I,1,Dr. Mohammad Sardaraz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-07,1700-1830,ECI670,Neural and Fuzzy Systems,RCE-I,1,Dr. Muhammad Ismail Khan,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
4,2026-11-10,1700-1830,EEE610,Engineering Mathematics,RCE-I,1,Dr. Saeed Ehsan Awan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
5,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RCE-II,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
6,2026-11-05,1700-1830,EEE621,Modeling and Simulation,RCE-II,1,Dr. Mohammad Sardaraz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
7,2026-11-07,1700-1830,ECI670,Neural and Fuzzy Systems,RCE-II,1,Dr. Muhammad Ismail Khan,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
8,2026-11-10,1700-1830,EEE610,Engineering Mathematics,RCE-II,1,Dr. Saeed Ehsan Awan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
9,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RCE-IV,2,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
10,2026-11-06,1700-1830,ETN671,Advanced Computer Networks,RCE-IV,1,Muhammad Fahad Khan,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
11,2026-11-10,1700-1830,ETN772,Networks and Computer Security,RCE-IV,1,Dr. Muhammad Saleem Khan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,RCS,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM701,Understanding of Holy Quran -1 (Fehm-e-Quran-1),RCS-I,13,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,MCS601,Advanced Computational Models and Algorithms,RCS-I,13,Dr. Mohammad Sardaraz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-06,1700-1830,MDS710,Advanced Data Mining,RCS-I,13,Dr. Sadaf Yasmin,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
4,2026-11-07,1700-1830,MAI732,Advanced Natural Language Processing,RCS-I,9,Dr. Muhammad Shahzad Faisal CS,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
5,2026-11-10,1700-1830,MCY651,Security and Privacy in IoT,RCS-I,11,Dr. Muhammad Saleem Khan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
6,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RCS-II,12,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
7,2026-11-05,1700-1830,MCS601,Advanced Computational Models and Algorithms,RCS-II,12,Dr. Mohammad Sardaraz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
8,2026-11-06,1700-1830,MCS623,Advanced Computer Networks,RCS-II,2,Muhammad Fahad Khan,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
9,2026-11-06,1700-1830,MDS710,Advanced Data Mining,RCS-II,10,Dr. Sadaf Yasmin,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
10,2026-11-07,1700-1830,MAI732,Advanced Natural Language Processing,RCS-II,12,Dr. Muhammad Shahzad Faisal CS,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
11,2026-11-10,1700-1830,MCY651,Security and Privacy in IoT,RCS-II,12,Dr. Muhammad Saleem Khan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
12,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RCS-III,5,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
13,2026-11-06,1700-1830,MDS710,Advanced Data Mining,RCS-III,5,Dr. Sadaf Yasmin,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
14,2026-11-07,1700-1830,MAI732,Advanced Natural Language Processing,RCS-III,3,Dr. Muhammad Shahzad Faisal CS,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,REE,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM701,Understanding of Holy Quran -1 (Fehm-e-Quran-1),REE-I,3,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,EPE663,Renewable Energy Technologies,REE-I,1,Dr. Assad Hafiz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-06,1700-1830,EPE625,Advanced Power System Analysis,REE-I,1,Yasir Muhammad,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
4,2026-11-06,1700-1830,ETN872,Special Topics in Computer Networks,REE-I,2,Muhammad Fahad Khan,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
5,2026-11-07,1700-1830,ECI670,Neural and Fuzzy Systems,REE-I,2,Dr. Muhammad Ismail Khan,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
6,2026-11-10,1700-1830,EEE610,Engineering Mathematics,REE-I,1,Dr. Saeed Ehsan Awan,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
7,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),REE-III,2,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
8,2026-11-05,1700-1830,EPE663,Renewable Energy Technologies,REE-III,2,Dr. Assad Hafiz,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
9,2026-11-06,1700-1830,EPE625,Advanced Power System Analysis,REE-III,2,Yasir Muhammad,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,RMS,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM701,Understanding of Holy Quran -1 (Fehm-e-Quran-1),RMS-I,8,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,MGT704,Research Methodology,RMS-I,8,Dr. Faisal Nawaz Mir,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-06,1700-1830,MGT730,Advanced Topics in Financial Management,RMS-I,2,Dr. Muhammad Faisal Shahzad Mgt. Sc.,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
4,2026-11-07,1700-1830,MGT781,Strategic HRM,RMS-I,6,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
5,2026-11-10,1700-1830,MGT712,AdvanHRDM,RMS-I,6,Muhammad Usman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
6,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RMS-II,1,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
7,2026-11-05,1700-1830,MGT608,Statistical Inference & Research Methodology,RMS-II,1,Dr. Faisal Nawaz Mir,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
8,2026-11-07,1700-1830,MGT781,Strategic HRM,RMS-II,1,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
9,2026-11-10,1700-1830,MGT712,AdvanHRDM,RMS-II,1,Muhammad Usman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
10,2026-11-06,1700-1830,MGT730,Advanced Topics in Financial Management,RMS-III,3,Dr. Muhammad Faisal Shahzad Mgt. Sc.,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
11,2026-11-07,1700-1830,MGT781,Strategic HRM,RMS-III,1,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
12,2026-11-10,1700-1830,MGT712,AdvanHRDM,RMS-III,2,Muhammad Usman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
13,2026-11-10,1700-1830,MGT731,Advanced Topics in International Finance,RMS-III,1,Dr. Asim Anwar,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
14,2026-11-10,1700-1830,MGT712,AdvanHRDM,RMS-IV,3,Muhammad Usman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
15,2026-11-07,1700-1830,MGT781,Strategic HRM,RMS-V,1,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
16,2026-11-10,1700-1830,MGT716,Advanced Topics in Performance Management Systems,RMS-V,1,Muhammad Usman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
17,2026-11-07,1700-1830,MGT781,Strategic HRM,RMS-VI,1,Dr. Adeel Saqib,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
18,2026-11-10,1700-1830,MGT716,Advanced Topics in Performance Management Systems,RMS-VI,1,Muhammad Usman,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
,COMSATS University Islamabad,,,,,,,,
,Attock Campus,,,,,,,,
,Midterm Exams - FA26 (Fall 2026),,,,,,,,
,RMT,,,,,,,,
,,,,,,,,,
S No,Date,Time,Course Code,Course Title,Class,Strength,Instructor,Hall/Room,Invigilators
1,2026-11-04,1700-1830,HUM701,Understanding of Holy Quran -1 (Fehm-e-Quran-1),RMT-I,12,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
2,2026-11-05,1700-1830,MTH722,Mathematical Analysis,RMT-I,12,Dr. Sohail Ahmad,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
3,2026-11-06,1700-1830,MTH782,Non-Newtonian Fluid Mechanics,RMT-I,12,Dr. Muhammad Zeb,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
4,2026-11-07,1700-1830,MTH702,Optimization Theory,RMT-I,12,Dr. Asif Waheed,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
5,2026-11-10,1700-1830,MTH709,Advanced Partial Differential Equations,RMT-I,11,Dr. Noor Muhammad,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
6,2026-11-05,1700-1830,MTH722,Mathematical Analysis,RMT-II,3,Dr. Sohail Ahmad,EEhall,"Dr. Mohammad Sardaraz, Dr. Faisal Nawaz Mir, Dr. Assad Hafiz"
7,2026-11-06,1700-1830,MTH782,Non-Newtonian Fluid Mechanics,RMT-II,3,Dr. Muhammad Zeb,EEhall,"Dr. Farooq Ahmed Shah, Muhammad Fahad Khan, Dr. Muhammad Zeb"
8,2026-11-07,1700-1830,MTH702,Optimization Theory,RMT-II,3,Dr. Asif Waheed,EEhall,"Dr. Adeel Saqib, Dr. Muhammad Ismail Khan, Abdul Ahad"
9,2026-11-10,1700-1830,MTH709,Advanced Partial Differential Equations,RMT-II,3,Dr. Noor Muhammad,EEhall,"Muhammad Usman, Dr. Saeed Ehsan Awan, Dr. Noor Muhammad"
10,2026-11-04,1700-1830,HUM702,Understanding of Holy Quran – II (Fehm-e-Quran–II),RMT-III,6,Visiting Mgt Taimoor Farooq,EEhall,"Dr. Saddam Hussain, Visiting Mgt Taimoor Farooq, Qazi Zia Ullah"
`;

// Parse CSV lines
const lines = csvRaw.split('\n').map(l => l.trim()).filter(Boolean);
let currentSection = 'General';
const exams = [];
let idCounter = 1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('Midterm Exams')) {
    // next line might have department
    continue;
  }
  if (line.startsWith('S No,Date,Time')) {
    continue;
  }
  if (line.startsWith(',COMSATS') || line.startsWith(',Attock Campus') || line.replace(/,/g, '') === '') {
    continue;
  }
  
  // Check if header with single word e.g. ",BAF,,,,,,,," or ",Bachelor of Business Administration,,,,,,,,"
  if (line.startsWith(',') && !line.match(/^,\d{4}-\d{2}-\d{2}/)) {
    const clean = line.replace(/,/g, '').trim();
    if (clean) {
      currentSection = clean;
    }
    continue;
  }

  // Parse CSV line with quotes support
  const match = [];
  let cur = '';
  let inQuotes = false;
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      match.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  match.push(cur.trim());

  if (match.length >= 9 && match[1] && match[1].match(/^\d{4}-\d{2}-\d{2}$/)) {
    let originalDate = match[1];
    let date = originalDate;
    let isRescheduled = false;

    // RULE: 4 November papers are shifted to 12 November!
    if (originalDate === '2026-11-04') {
      date = '2026-11-12';
      isRescheduled = true;
    }

    const rawTime = match[2]; // e.g. "1010-1140", "0830-1000", "1330-1500", "1500-1630", "1700-1830"
    let startTime = '';
    let endTime = '';
    if (rawTime.includes('-')) {
      const [s, e] = rawTime.split('-');
      const formatTime = (t) => {
        if (!t || t.length < 4) return t;
        let h = parseInt(t.slice(0, 2), 10);
        let m = t.slice(2, 4);
        let ampm = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12 || 12;
        return `${h12}:${m} ${ampm}`;
      };
      startTime = formatTime(s);
      endTime = formatTime(e);
    }

    const courseCode = match[3];
    const courseTitle = match[4];
    const className = match[5];
    const strength = parseInt(match[6] || '0', 10);
    const instructor = match[7];
    const room = match[8];
    const invigilators = match[9] || '';

    exams.push({
      id: idCounter++,
      section: currentSection,
      originalDate,
      date,
      isRescheduled,
      rawTime,
      startTime,
      endTime,
      courseCode,
      courseTitle,
      className,
      strength,
      instructor,
      room,
      invigilators,
    });
  }
}

// Extract unique classes/batches
const classes = [...new Set(exams.map(e => e.className))].sort();
// Extract unique dates
const dates = [...new Set(exams.map(e => e.date))].sort();

const payload = {
  title: "CUI Attock Midterm Exams - FA26 (Fall 2026)",
  notice: "Papers originally scheduled for 4 November 2026 are shifted to 12 November 2026. Time and rooms remain identical.",
  expirationIso: "2026-11-12T19:30:00+05:00", // Automatically expires once exams conclude
  totalExams: exams.length,
  dates,
  classes,
  exams,
};

const outPath = path.resolve('src/data/midterm-datesheet.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log('Successfully generated ' + outPath + ' with ' + exams.length + ' exams!');
console.log('Unique classes:', classes.length);
console.log('Exam dates:', dates);
console.log('Shifted from 4 Nov to 12 Nov count:', exams.filter(e => e.isRescheduled).length);
