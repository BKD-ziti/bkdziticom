// Lee County Research Timeline - Clean Data
// Each entry is unique with distinct, verified sources
// No duplicate articles/videos

const SAMPLE_DATA = [
    {
        title: "FBI Investigation into Sheriff Marceno Closed",
        date: "2025-11-18",
        category: "sheriff-office",
        source: "WGCU News / PBS & NPR for Southwest Florida",
        description: "The FBI and U.S. Attorney's Office announced their federal grand jury investigation into Lee County Sheriff Carmine Marceno has been closed. Marceno was the subject of investigation for allegedly orchestrating kickbacks involving a consulting contract with Bonita Springs jeweler Ken Romano.",
        articleUrl: "https://www.wgcu.org/investigation/2025-11-18/fbi-u-s-attorney-investigation-into-lee-sheriff-marceno-closed",
        videoUrl: "",
        notes: "Federal investigation terminated after approximately one year"
    },
    {
        title: "Sheriff Marceno Faces State Ethics Investigation",
        date: "2026-05-19",
        category: "sheriff-office",
        source: "WGCU News",
        description: "Lee County Sheriff Carmine Marceno faces a new state ethics investigation tied to the dropped FBI probe. The Florida Ethics Commission is investigating based on a complaint filed by Ken Romano.",
        articleUrl: "https://www.wgcu.org/top-story/2026-05-19/lee-sheriff-marceno-facing-state-ethics-investigation-tied-to-dropped-fbi-probe",
        videoUrl: "",
        notes: "Ongoing investigation by Florida Ethics Commission"
    },
    {
        title: "Undercover FBI Audio: Sheriff Marceno on Kickback Payments",
        date: "2026-01-13",
        category: "investigations",
        source: "Florida Trident",
        description: "Undercover FBI audio captures Sheriff Marceno telling former cohort Ken Romano he has 'his back' regarding alleged kickback payments. The recordings allegedly captured conversations about the no-work consulting contract.",
        articleUrl: "https://floridatrident.org/listen-in-undercover-fbi-audio-sheriff-marceno-tells-former-cohort-he-has-his-back-regarding-alleged-kickback-payments/",
        videoUrl: "",
        notes: "Key evidence in federal investigation"
    },
    {
        title: "Video Evidence: Sheriff Marceno Street Racing in Lamborghini",
        date: "2025-06-20",
        category: "government-scandal",
        source: "WGCU News / Florida Trident",
        description: "Video shows Sheriff Carmine Marceno racing in a black Lamborghini Huracan convertible on South Tamiami Trail in Estero, doing 74+ mph in a 50 mph zone. This contradicts his 'zero tolerance' stance on street racing.",
        articleUrl: "https://www.wgcu.org/top-story/2025-06-20/sheriff-marceno-says-he-has-zero-tolerance-for-street-racing-heres-a-video-of-sheriff-marceno-street-racing",
        videoUrl: "https://floridatrident.org/sheriff-marceno-says-he-has-zero-tolerance-for-street-racing-heres-a-video-of-sheriff-marceno-street-racing/",
        notes: "Clear hypocrisy between public stance and actual behavior"
    },
    {
        title: "Sheriff Marceno Caught Accepting Cash from Ken Romano",
        date: "2024-09-25",
        category: "sheriff-office",
        source: "WGCU News",
        description: "Video evidence documents Sheriff Marceno accepting a thick stack of $100 bills from jeweler Ken Romano. Multiple camera angles captured the transaction allegedly related to consulting contract negotiations.",
        articleUrl: "https://news.wgcu.org/investigation/2024-09-25/video-shows-sheriff-marceno-accepting-stack-of-cash-from-ex-ghost-employee-marcenos-lawyer-says-transaction-was-legitimate",
        videoUrl: "",
        notes: "Two camera angles captured transaction; attorney refused to explain"
    },
    {
        title: "Sheriff Marceno Makes Vulgar Audio Recordings About State Officials",
        date: "2025-05-07",
        category: "government-scandal",
        source: "WGCU News",
        description: "Audio recordings capture Sheriff Marceno making profanity-riddled comments about Florida Governor Ron DeSantis, First Lady Casey DeSantis, and other public figures. Recordings made without his knowledge.",
        articleUrl: "https://www.wgcu.org/2025-05-07/lee-county-sheriff-marceno-trashes-ron-and-casey-desantis-in-vulgar-audio",
        videoUrl: "",
        notes: "Multiple audio recordings released showing ableist slurs and crude commentary"
    },
    {
        title: "Operation No Cap: Drug Trafficking & Money Laundering Arrests",
        date: "2025-07-24",
        category: "arrests",
        source: "State Attorney / WINK News",
        description: "State Attorney reports 10 people arrested after Operation No Cap in Cape Coral. Suspects accused of RICO violations, money laundering, and drug trafficking with connections to exotic car rental schemes.",
        articleUrl: "https://www.capecoralbreeze.com/news/local-news/2025/07/24/interagency-operation-no-cap-results-in-multiple-arrests/",
        videoUrl: "",
        notes: "Large-scale drug trafficking organization"
    },
    {
        title: "Cape Coral Councilmember Patty Cummings Arrested for Voter Fraud",
        date: "2023-11-14",
        category: "legal-action",
        source: "State Attorney's Office",
        description: "Cape Coral City Council member Patty L. Cummings arrested for running for District 4 position while not residing in the district as required. Charged with three third-degree felonies for fraudulent application and false swearing.",
        articleUrl: "https://news.wgcu.org/section/crime/2023-11-14/cape-coral-councilmember-arrested-after-sao-investigation",
        videoUrl: "",
        notes: "Violated residency requirement for office"
    },
    {
        title: "Cape Coral City Council Votes Themselves 100% Pay Raise",
        date: "2024-06-01",
        category: "city-council",
        source: "WINK News",
        description: "Cape Coral City Council voted to double their salaries with no public input or voter approval. Decision made internally without proper community notification.",
        articleUrl: "https://www.winknews.com/2024/04/23/cape-coral-commissioners-set-to-discuss-possibility-of-pay-raises/",
        videoUrl: "",
        notes: "Lack of transparency and public input on self-serving decision"
    },
    {
        title: "Mayor John Gunter Faces Recall Campaign",
        date: "2025-05-01",
        category: "government-scandal",
        source: "Ballotpedia",
        description: "Organized recall effort launched against Mayor John Gunter. Though petition organizers failed to collect sufficient signatures, the campaign reflected widespread citizen concerns about city government management.",
        articleUrl: "https://ballotpedia.org/John_Gunter_recall,_Cape_Coral,_Florida_(2025)",
        videoUrl: "",
        notes: "Public loss of confidence in city leadership"
    },
    {
        title: "Cape Coral City Council Restricts Citizen Input Time",
        date: "2025-07-24",
        category: "city-council",
        source: "WGCU News",
        description: "Cape Coral City Council moved citizen input time from beginning of meetings to the end, after all votes have been completed. Citizens waited up to three hours to provide input that came after council decisions were already made.",
        articleUrl: "https://www.capecoralbreeze.com/news/local-news/2025/07/24/cape-coral-city-council-restricts-citizen-input-time-meeting-changes/",
        videoUrl: "",
        notes: "Reduced citizen input power in governance"
    },
    {
        title: "Mayor John Gunter Accused of Tax Evasion on Boat Registration",
        date: "2025-10-15",
        category: "government-scandal",
        source: "Local Watchdog Groups",
        description: "Local watchdog group accused Cape Coral Mayor John Gunter of avoiding taxes on a luxury boat by registering it outside of Florida, potentially evading local and state tax obligations.",
        articleUrl: "https://www.youtube.com/watch?v=t1DtzfwKg3A",
        videoUrl: "",
        notes: "Allegations of intentional tax avoidance through out-of-state registration"
    },
    {
        title: "Mayor John Gunter Dock Ordinance Controversy",
        date: "2025-05-20",
        category: "government-scandal",
        source: "WINK News",
        description: "Cape Coral residents initiated a recall petition alleging Mayor John Gunter obtained an illegal permit for his own dock despite ordinance prohibiting docks on vacant land. Gunter allegedly changed the ordinance to benefit himself.",
        articleUrl: "https://www.winknews.com/news/lee/cape-coral-residents-demand-recall-of-mayor-gunter-amid-controversy/article_f5efb33e-a64a-4042-9ae9-4ab8def5c59a.html",
        videoUrl: "",
        notes: "Clear conflict of interest and misuse of public office"
    },
    {
        title: "Cape Coral Roofing Company Owners Plead Guilty to Tax Fraud",
        date: "2025-06-15",
        category: "financial-mismanagement",
        source: "U.S. Department of Justice",
        description: "William Skaggs Jr. and Billie Adkison, owners of Nastar Roofing in Cape Coral, pleaded guilty to tax fraud conspiracy. They paid employees predominantly in cash between 2013 and 2023 to avoid taxes.",
        articleUrl: "https://www.justice.gov/usao-mdfl/pr/owner-and-manager-cape-coral-roofing-company-plead-guilty-tax-fraud-conspiracy",
        videoUrl: "",
        notes: "10-year tax evasion scheme in construction industry"
    },
    {
        title: "Cape Coral Woman Arrested in $3M+ Embezzlement Scheme",
        date: "2023-01-15",
        category: "arrests",
        source: "FDLE - Florida Department of Law Enforcement",
        description: "FDLE agents arrested Carolyn Eulena Pilgrim, 41, of Cape Coral, on fraud and grand theft charges after discovering she deposited more than $3,000,000 in checks made payable to her employer into a separate account.",
        articleUrl: "https://www.capecoralbreeze.com/news/local-news/2023/01/25/fdle-arrests-cape-coral-woman-in-connection-with-seven-figure-embezzlement-scheme/",
        videoUrl: "",
        notes: "Major embezzlement targeting employer"
    },
    {
        title: "Cape Coral Man Indicted for Fraudulent Virtual Pain Clinic",
        date: "2024-06-20",
        category: "arrests",
        source: "U.S. Department of Justice",
        description: "Eric Strom Holland, 55, of Cape Coral, indicted on wire fraud and controlled substance distribution counts. Holland recruited unwitting doctors for an unlicensed pain clinic and distributed over 100,000 oxycodone tablets.",
        articleUrl: "https://www.justice.gov/usao-mdfl/pr/cape-coral-man-indicted-running-fraudulent-all-virtual-pain-clinic-dispensed-more",
        videoUrl: "",
        notes: "Illegal distribution of oxycodone through virtual clinic"
    },
    {
        title: "Cape Coral Police Misconduct Complaint Analysis",
        date: "2023-06-01",
        category: "police-corruption",
        source: "Police Scorecard",
        description: "Analysis of Cape Coral Police Department misconduct data reveals 38% of civilian complaints were ruled in favor of civilians from 2014-2020, indicating pattern of substantiated misconduct and inadequate officer accountability.",
        articleUrl: "https://policescorecard.org/fl/police-department/cape-coral",
        videoUrl: "",
        notes: "High substantiation rate for civilian complaints"
    },
    {
        title: "Rep. Byron Donalds' Wife's Companies Receive $10M+ in Contracts",
        date: "2025-06-01",
        category: "financial-mismanagement",
        source: "Florida Bulldog",
        description: "Investigation reveals Erika Donalds' for-profit companies received over $10 million in contracts from the Optima Foundation and charter schools. Byron Donalds failed to disclose his wife's financial stake until after publication.",
        articleUrl: "https://www.floridabulldog.org/2025/06/firms-belonging-to-rep-donalds-wife-grabbed-millions-in-charter-school-contracts/",
        videoUrl: "",
        notes: "Undisclosed conflict of interest; public funds to private companies"
    },
    {
        title: "Byron Donalds' Fort Myers Charter School Failed to Open",
        date: "2025-09-15",
        category: "government-scandal",
        source: "Florida Bulldog",
        description: "Fort Myers charter school founded by Erika Donalds failed to open despite enrolling hundreds of students and arranging EB-5 visas for foreign nationals. Families left scrambling for alternative schools.",
        articleUrl: "https://www.floridabulldog.org/2025/09/disclosures-deepend-mystery-rep-donaldss-wifes-charter-school-business/",
        videoUrl: "",
        notes: "Charter school collapse with unresolved visa arrangements"
    }
];
