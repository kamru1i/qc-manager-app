export interface AdminFine {
  title: string;
  amount: string;
  detail: string;
}

export interface Company {
  name: string;
  tags: string[];
  branch_priority: string[];
  doc_extensions: string[];
  common_rules: string[];
}

export interface InsuranceDatabase {
  global_announcements: {
    nby_rule: string;
    general_pricing: string;
  };
  admin_fines: AdminFine[];
  universal_rules: {
    employment: string[];
    driver_and_usage: string[];
    license_and_residency: string[];
    file_processing: string[];
  };
  companies: Company[];
}

export const INSURANCE_DATABASE: InsuranceDatabase = {
  global_announcements: {
    nby_rule: "🚨 CRITICAL CAR PURCHASE DATE (NBY) RULE: ফাইলে সরাসরি Not Bought Yet (NBY) লেখা থাকলেও কোনো অবস্থাতেই সিস্টেমে NBY ব্যবহার করা যাবে না। As it is & EUI এর ক্ষেত্রে: NBY এর পরিবর্তে বর্তমানের রানিং মাস ও রানিং বছর (যেমন: 06/2026) ব্যবহার করতে হবে। Utilize Driver Rules: অতিরিক্ত ড্রাইভারকে Proposer/PH বানালে বা ফাইল Utilize করার সময়ও NBY দেওয়া যাবে না, রানিং মাস ও বছর ব্যবহার করতে হবে। Branch Restrictions (BC, BI, AQ, RIDE): এই ব্রাঞ্চগুলোর জন্য Car Purchase Date ফাইলে যা উল্লেখ আছে (যেমন: 01/2025) সেটাই রাখতে হবে, NBY কোনোভাবেই দেওয়া যাবে না। ব্যতিক্রম: শুধুমাত্র ওপরে মালিকানা পরিবর্তন মেনশন করে প্রাইসের ওপর উল্লেখ থাকলে পরিবর্তন করা যাবে। Broad AQ Ride Branch Exception: এই ব্রাঞ্চে কার NBY দিয়ে ওপরে উল্লেখ করে একুরেট পারচেজ ডেট সহ ১টি প্রাইস দেওয়া যাবে।",
    general_pricing: "💡 নিউ প্রাইজ বা রিফ্রেশ প্রাইজ আপডেট দিলে Monthly এবং Annually দুটিই দিতে হবে। সব কোম্পানির জন্য সব ধরনের প্রাইসিং (Lite, Essential, Plus, Bronze, Silver, Gold, Box, Without Box) সম্পূর্ণ আপডেট করতে হবে।"
  },

  admin_fines: [
    { title: "ভুল আপডেট (Wrong Update)", amount: "৫০০ টাকা জরিমানা", detail: "অপারেটর ফাইলে ভুল প্রাইস বা তথ্য আপডেট করলে।" },
    { title: "নোট অমান্য করা (Note Deviation)", amount: "১০০০ টাকা জরিমানা", detail: "ফাইলের ভেতরের অফিশিয়াল নোট অনুযায়ী কাজ না করলে।" },
    { title: "EUI ও As it is নিয়ম লঙ্ঘন", amount: "২০০০-৩০০০ টাকা", detail: "লগ-ইন ও অ্যাটেম্পট সংক্রান্ত নিয়ম (৩ বারের বেশি চেক না করা, IP বসানো) না মানলে।" },
    { title: "Second Best Price মিসিং", amount: "Financial Fine", detail: "Acorn এবং Esure Flex এর প্রাইস আপডেটের সাথে সেকেন্ড বেস্ট প্রাইস আপডেট না করলে সরাসরি আর্থিক জরিমানা।" }
  ],

  universal_rules: {
    employment: [
      "ফাইলে 'Self-employed' থাকলে তা কোনোভাবেই পরিবর্তন করা যাবে না। পরিবর্তন করে শুধু Employed দেখালে সরাসরি Red S2D করতে হবে।",
      "Company Director/Proprietor থাকলে কাস্টমার শুধু employed দিলেও আমাদেরকে মাস্ট 'Self-employed' দেখাতে হবে।",
      "Hotfood ফাইলে সবসময় 'Self-employed' ব্যবহার করতে হবে, ফাইলে যা-ই থাকুক না কেন।",
      "Delivery Driver-কে Supervisor/Manager দেখালে মাস্ট S2D RED করতে হবে।",
      "পেশা হিসেবে 'Superintendent' এবং 'Production Manager' ব্যবহার করা সম্পূর্ণ বন্ধ (খুব প্রয়োজনে টিম লিডারের অনুমতি নিতে হবে)।",
      "Carer/Care Assistant থাকলে সবসময় 'Professional' সিলেক্ট করতে হবে।",
      "পেশা পরিবর্তন করলে সংশ্লিষ্ট ইন্ডাস্ট্রিও অবশ্যই পরিবর্তন করতে হবে এবং দেখতে হবে ইন্ডাস্ট্রির সাথে পেশাটির মিল আছে কি না।"
    ],
    driver_and_usage: [
      "অতিরিক্ত ড্রাইভার রিভার্স চেক: ফাইলে অতিরিক্ত ড্রাইভার থাকলে তাদের বাদ দিয়ে রিভার্স চেক করা বাধ্যতামূলক। PH-এর ১০০ বছরের NCD থাকলেও এবং অতিরিক্ত ড্রাইভার spouse হলেও রিভার্স করে দেখতে হবে।",
      "ফাইলে Student, House Person, বা Retired থাকলে এবং Car Usage = SDPC হলে: SDPC দিয়ে একটা প্রাইস এবং SDP দিয়ে আরেকটি প্রাইস দিতে হবে।",
      "যদি প্রাইস কমাতে আমরা এগুলো ব্যবহার করি, তবে Car Usage মাস্ট SDP দিতে হবে এবং পাশাপাশি অরিজিনাল ইউজেস দিয়ে আরেকটি প্রাইস দিতে হবে।",
      "PH যদি স্টুডেন্ট হয় তবে ইউজেস সবসময় SDP রাখতে হবে (ভুল করে SDPC দিলে ভ্যালিডেশনে আটকে প্রুফ চায়)।"
    ],
    license_and_residency: [
      "Northern Ireland License: iresure ফাইলের ক্ষেত্রে কোনো ফেক বা র্যান্ডম লাইসেন্স নম্বর ব্যবহার করা যাবে না। নর্দান আয়ারল্যান্ডের লাইসেন্স ৮ ডিজিটের হয়। ব্ল্যাঙ্ক বা ৮ ডিজিট থাকলে মনগড়া কিছু না বসিয়ে, ১৬ ডিজিটের সঠিক নম্বর থাকলে তবেই কোট জেনারেট করবেন।",
      "International License Residency: ইন্টারন্যাশনাল লাইসেন্সের ফাইলে Residency সবসময় আগের মাস (Previous Month) রাখতে হবে। Residency ক্রসম্যাচ করতে হলে 'crossmatched' লিখে কারেন্ট মাসের আগের মাস দিয়ে ফাইল ডান করতে হবে।"
    ],
    file_processing: [
      "ফ্রেশ ফাইল হ্যান্ডলিং: প্রতিদিন কাজ শুরুর পর প্রথম ফ্রেশ ফাইলগুলো মাস্ট সিনিয়রেরা নিবেন। সিনিয়েরা ফ্রি না থাকলে তখন বাকিরা নিতে পারবেন।",
      "ফাইল প্রসেসিং টাইম: অফিশিয়াল বা টেকনিক্যাল সমস্যার কারণে কোনো ফাইলে বেশি সময় লাগলে তা অতি দ্রুত সিনিয়র এবং অ্যাডমিনকে জানাতে হবে।",
      "ইনফো অপশন পূরণ: ভ্যালিডেশন ছাড়া ইনফো দেওয়ার সময় কোনোভাবেই need time plz লিখে ফাইল ফেলে রাখা যাবে না। প্রত্যেক অপারেটরকে ২০-২২টি ইনফো অপশন সম্পূর্ণ পূরণ করে রাখতে হবে, যেন কেউ ছুটিতে থাকলেও অন্য কেউ ওয়ার্ড ফাইল খুলেই সাথে সাথে প্রাইস পায়। স্লো কাজ করে এমন কাউকে ছুটির ব্যক্তির ফাইল দেওয়া যাবে না।",
      "রিভিউ পলিসি: যারা ফাইল রিভিউ করবেন, তারা মাদার সাইট বা Other site-এ প্রাইস কত ছিল এবং আমরা ১ম বা ২য় বার কতটুকু কম দিতে পারলাম তা চেক করবেন। ভালো চিপার (Cheaper) প্রাইস হলে অ্যাডমিনের সাথে কথা বলে কনফার্ম করবেন।"
    ]
  },

  companies: [
    {
      name: "Acorn / Motorcade / Acorn Protect Box",
      tags: ["acorn", "motorcade", "protect", "box"],
      branch_priority: [
        "Sort & Iresure Branch: Sort এবং Iresure ব্রাঞ্চের ফাইলের জন্য Acorn-এর প্রাইস দেওয়ার কোনো প্রয়োজন নেই [Date: 30/12/2025]।",
        "Get & Middlesure Branch: Get এবং Middlesure ব্রাঞ্চে Acorn-এর প্রাইস দেওয়ার সময় অবশ্যই Occupation Industry উল্লেখ (Mention) করতে হবে [Date: 21/10/2025]।",
        "Eazy, Bristol, Swandrive, Iresure Branch: এই ৪টি ব্রাঞ্চের জন্য Acorn-এর RED এবং Green ২টি প্রাইসই দেওয়া যাবে এবং লাইসেন্স হেল্ড (License held) পরিবর্তন করা যাবে [Date: 13/02/2026]।"
      ],
      doc_extensions: [
        "DOC Cover: Acorn পলিসির আন্ডারে কাস্টমার ইউরোপে ড্রাইভ করার জন্য থার্ড পার্টি কাভার পাবেন।",
        "DOC Restriction: বিশেষ নোট: Acorn থার্ড পার্টি গাড়ি (3rd party cars) ড্রাইভ করতে দেয় না।"
      ],
      common_rules: [
        "Acorn-এর প্রাইস আপডেট দিলে ২য় সেরা কোম্পানির (Second-Best Company) কোটেশন বা প্রাইস অবশ্যই দিতে হবে, অন্যথায় ফাইন্যান্সিয়াল ফাইন হবে।",
        "যদি Additional Driver সহ Acorn-এর প্রাইস আসে এবং সিঙ্গেল ও ইউটিলাইজড প্রাইস নেওয়ার পরও একই কোম্পানি আসে, তবে Acorn-এর প্রাইস আর আপডেট না দিয়ে অন্য কোম্পানির প্রাইস দিতে হবে।",
        "২ জন বা তার বেশি ড্রাইভার থাকলে ২ বা ৩টি গাড়ির ভ্যারিয়েশন রাখতে হবে এবং মাইলএজ ৪০০০-৫০০০-৬০০০-৭০০০ ভ্যারিয়েশনে দিতে হবে।",
        "ফার্স্ট নেম (1st name) না থাকলে এবং লাইসেন্স নম্বরে '999' থাকলে Acorn-এর প্রাইস দেওয়া যাবে না।",
        "Acorn গ্রুপ এবং EUI গ্রুপের জন্য মিডল নেম নিচে নামিয়ে প্রাইস দেওয়া যাবে না।",
        "Occupation Industry ফাইলের সাথে অবশ্যই Similar রাখার চেষ্টা করতে হবে।"
      ]
    },
    {
      name: "Marshmallow / Marshmallow Move or Go Box",
      tags: ["marshmallow", "move", "go"],
      branch_priority: [
        "Eazy, Bristol, Swandrive, Iresure Branch: শুধুমাত্র এই ৪টি ব্রাঞ্চের জন্য Marshmallow-এর RED এবং Green ২টি প্রাইসই দেওয়া যাবে এবং এদের ক্ষেত্রে লাইসেন্স হেল্ড পরিবর্তন করা যাবে [Date: 13/02/2026]।",
        "Other Branches Restriction: Eazy, Bristol, Swandrive, Iresure—এই ৪টি ব্রাঞ্চ ছাড়া অন্য কোনো ব্রাঞ্চের ফাইলে Marshmallow-এর জন্য Occupation / Industry চেইঞ্জ করা সম্পূর্ণ নিষেধ [Date: 28/02/2026]।"
      ],
      doc_extensions: [
        "Marshmallow Plus Plan: এই প্ল্যানে Driving Other Cars (Third-Party Only - গাড়ির দুর্ঘটনা হলে শুধু ৩য় পক্ষ ক্ষতিপূরণ পাবে), Breakdown Cover, Motor Legal Protection, এবং Courtesy Car ইনক্লুডেড থাকে।"
      ],
      common_rules: [
        "Occupation সবসময় ফাইলের সাথে হুবহু এক (Keep same as file) রাখতে হবে।",
        "Marshmallow কোম্পানির আপডেট দিলে কাস্টমার প্যানেলে IP এবং MAC Address অবশ্যই উল্লেখ (Must be mention) করতে হবে।",
        "কাস্টমারের ড্রাইভিং লাইসেন্স নম্বর থাকলেও Marshmallow-তে কোনোভাবেই লাইসেন্স নম্বর ব্যবহার করা যাবে না।",
        "যদি ফাইলে কোনো Occupation/Business দেওয়া না থাকে, তবে Marshmallow-তে Sales Assistant & Retailing দিয়ে প্রাইস দেওয়া যাবে।",
        "প্রত্যেককে অবশ্যই Marshmallow Original Price আপডেট করতে হবে।"
      ]
    },
    {
      name: "Esure / Esure Flex / Sheilas' Wheels",
      tags: ["esure", "flex", "sheilas", "wheels"],
      branch_priority: [
        "Eazy, Bristol, Swandrive, Iresure Branch: শুধুমাত্র এই ৪টি ব্রাঞ্চের জন্য Esure Flex-এর আপডেটটি প্রযোজ্য হবে [Date: 13/02/2026]।"
      ],
      doc_extensions: [
        "Esure Flex & Esure Original: এই কোম্পানির পলিসিতে Driving other cars এবং 'Uninsured driver promise' সুবিধাটি ডিফল্টভাবে অন্তর্ভুক্ত বা Included থাকে।"
      ],
      common_rules: [
        "Esure Flex এর প্রাইস আপডেট দিলে Second Best Price অবশ্যই আপডেট দিতে হবে।",
        "সিঙ্গেল ড্রাইভারের ক্ষেত্রে ৩টি গাড়ি দেওয়া সম্পূর্ণ নিষেধ, ২টা বা ১টা গাড়ির ভ্যারিয়েশন রেখে দিতে হবে। ২ জন বা তার বেশি ড্রাইভার থাকলে ২ বা ৩টি গাড়ি দিতে হবে।",
        "মাইলএজ ৪০০০-৫০০০-৬০০০-৭০০০ ভ্যারিয়েশনে রাখতে হবে। (৩০০০/৪০০০ মাইলএজ দেওয়া সম্পূর্ণ বন্ধ)।",
        "যদি Own another car = YES দেখানো হয়, তবে Household car: 03 ব্যবহার করতে হবে। Own another car = NO হলে Household car: 01 ব্যবহার করতে হবে।",
        "যেকোনো কোম্পানির ক্ষেত্রে Single Driver-এর ফাইলে Household Car-3 কোনোভাবেই ব্যবহার করা যাবে না।"
      ]
    },
    {
      name: "EUI / Admiral / Elephant / Diamond / Ford / Bellbox",
      tags: ["eui", "admiral", "elephant", "diamond", "ford", "bellbox"],
      branch_priority: [],
      doc_extensions: [
        "Provides Comprehensive cover details, but always cross-verify the main policyholder's eligibility."
      ],
      common_rules: [
        "CRITICAL RELATION RULE: Reg.keeper & Legal Owner: Parent রাখলে এবং ফাইলে Additional Driver Parent হলে, PH এর সাথে সম্পর্ক Unrelated বা commonlaw রাখা যাবে না। Must parent রাখতে হবে [26/02/2025]।",
        "EUI-এর জন্য এখন থেকে ২টি লগ-ইন নিতে হবে। ১ম লগ-ইনে As it is এর চেয়ে EUI ভালো প্রাইস দিলে অল্প অ্যাটেম্পটে আপডেট দিয়ে ওটা আর As it is এর জন্য ব্যবহার করা যাবে না। বেশি অ্যাটেম্পট লাগলে নতুন ২য় লগ-ইন নিতে হবে।",
        "EUI-তে কোনোভাবেই Name Causality করা যাবে না এবং দুই ড্রাইভারের পারস্পরিক সম্পর্ক পরিবর্তন করা যাবে না।",
        "EUI-তে পলিসি স্টার্ট ডেট (PSD) অবশ্যই মেনশন করতে হবে।",
        "Fault Accident-কে অবশ্যই Fault দেখাতে হবে এবং এর জন্য অন্য ২টি সাইটে (2 Othersite) কাজ করা বাধ্যতামুলক।",
        "শুধুমাত্র ইন্টারন্যাশনাল লাইসেন্সের ক্ষেত্রে EUI প্রাইসের জন্য মিডল নেম নিচে নামানো যাবে।",
        "কাস্টমারের জন্মসাল ১৯৯৮-২০০৭ (Too Young) হলে ফাইলে Homeowner: Yes ব্যবহার করা যাবে না (যদি আগে থেকেই না থাকে)।",
        "অ্যাক্সিডেন্ট ডেট ৩ বছরের বেশি পুরনো হলে ফাইলে অ্যাক্সিডেন্ট অ্যাড করার কোনো প্রয়োজন নেই।"
      ]
    },
    {
      name: "Tesco Bank / Tesco Bank Box",
      tags: ["tesco", "tesco bank", "tesco box"],
      branch_priority: [
        "MK Branch: MK ব্রাঞ্চের ফাইলে যদি অন্য কোনো উপায়ে প্রাইস কমানো সম্ভব না হয়, তবে সিনিয়রের অনুমতি নিয়ে RED S2D ব্যবহার করে Tesco-র প্রাইস নির্ধারণ করা যেতে পারে। তবে Green S2D দিয়েও প্রাইস দিতে হবে [Date: 22/11/2025]।"
      ],
      doc_extensions: [
        "DOC Restriction (Critical): ব্যাংক ইন্সুরেন্স কোম্পানিগুলোর মধ্যে সাধারণত সবাই DOC সুবিধা দিলেও, Tesco Bank-এর ক্ষেত্রে অন্য গাড়ি ড্রাইভ করার অনুমতিটি সম্পূর্ণ Conditional (শর্তসাপেক্ষ)।"
      ],
      common_rules: [
        "প্রাইস ইনসাইড সেভ (Price vitore save) দিতে হবে এবং Occupation অবশ্যই ফাইলের সাথে হুবহু মিল রাখতে হবে, পরিবর্তন করা যাবে না।",
        "মাইলএজ সবসময় ৫০০০ এর ওপরে দিতে হবে, ৩০০০ বা ৪০০০ মাইলএজ ব্যবহার করা সম্পূর্ণ নিষেধ।",
        "Tesco থেকে প্রাইস আসলে সবসময় Bronze এবং Silver উভয় টিয়ারের প্রাইস আপডেট করার চেষ্টা করতে হবে।"
      ]
    },
    {
      name: "Hastings Direct / Hastings Essential / Hastings YouDrive",
      tags: ["hastings", "direct", "essential", "youdrive"],
      branch_priority: [
        "Eazy, Bristol, Swandrive, Iresure Branch: শুধুমাত্র এই ৪টি ব্রাঞ্চের জন্য Hastings-এর RED & Green ২টি প্রাইসই দেওয়া যাবে এবং লাইসেন্স হেল্ড পরিবর্তন করা যাবে [Date: 13/02/2026]। *হেস্টিংস-এ লাইসেন্স নম্বর জোর করে বসানোর নিয়ম নেই।"
      ],
      doc_extensions: [
        "Hastings YouDrive Features: এই কোম্পানির পলিসিতে Driving Other Cars (ডিফল্ট চেকড থাকে), Courtesy Car, Claims Helpline এবং EU Cover অন্তর্ভুক্ত থাকে।"
      ],
      common_rules: [
        "Residency কোনোভাবেই পরিবর্তন করা যাবে না। ফাইলে অরিজিনাল লাইসেন্স নম্বর না থাকলে Hastings-এর কোটেশন দেওয়া যাবে না।",
        "Hastings-এ 'Student' ব্যবহার করতে হলে কাস্টমারের অরিজিনাল ফাইলে স্টুডেন্ট থাকা বাধ্যতামুলক।"
      ]
    },
    {
      name: "1st Central (Value, Core, Plus, Premier, Connect Box)",
      tags: ["1st central", "first central", "connect box"],
      branch_priority: [
        "Eazy, Bristol, Swandrive, Iresure Branch: শুধুমাত্র এই ৪টি ব্রাঞ্চের ক্ষেত্রে 1st Central-এর ফাইলে কাস্টমারের লাইসেন্স নম্বর প্রদান করা যাবে এবং RED ও Green ২টি প্রাইসই আপডেট করা যাবে [Date: 13/02/2026]।"
      ],
      doc_extensions: [],
      common_rules: [
        "রেফারেন্স নম্বর সবসময় ওয়েবসাইটের ভেতর থেকে (References number Bhitor Theke Nite Hoi) সংগ্রহ করতে হবে।"
      ]
    },
    {
      name: "Go Girl / insure2Drive",
      tags: ["go girl", "insure2drive", "gogirl"],
      branch_priority: [],
      doc_extensions: [
        "DOC Policy for Go Girl Group: Go Girl গ্রুপ কাস্টমারকে অন্য গাড়ি ড্রাইভ করার অনুমতি (DOC) প্রদান করবে, তবে SDP (Social, Domestic and Pleasure) ইউজেস ছাড়া বাকি ক্ষেত্রগুলোর জন্য এটি প্রযোজ্য (Except SDP)।"
      ],
      common_rules: [
        "রেফারেন্স নম্বর পরিবর্তন করা যাবে না (References number changed hova na)।",
        "ফাইলে ক্যান্সেলেশন দেওয়া থাকলে ক্যান্সেলেশন ছাড়া (Without Cancellation) প্রাইস দিতে হবে।",
        "Go Girl কোম্পানির জন্য রাতে কোনো অবস্থাতেই সবসময় 'Secure Public Car Park' ব্যবহার করা যাবে না। প্রয়োজনে ৫০-৮০ পাউন্ড বেশি আসলেও অন্য পার্কিং সিলেক্ট করতে হবে।"
      ]
    },
    {
      name: "Quote me Happy / Quotemehappy Plus / Aviva / General Accident",
      tags: ["quote me happy", "quotemehappy", "aviva", "general accident"],
      branch_priority: [],
      doc_extensions: [
        "Quotemehappy Plus & Aviva Online: এই কোটেশনে Driving other vehicles সুবিধাটি অন্তর্ভুক্ত থাকে এবং তা সম্পূর্ণ Third Party Cover Only হিসেবে গণ্য হবে (গাড়ির দুর্ঘটনা হলে শুধু ৩য় পক্ষ ক্ষতিপূরণ পাবেন)।"
      ],
      common_rules: [
        "পলিসি সেল হয় কিনা তা মাদার ওয়েবসাইট (Mother Website) থেকে অবশ্যই চেক করে নিতে হবে।",
        "কোনো Fresh ফাইলে যদি কেউ Quotemehappy group থেকে প্রাইস আপডেট দেয়, তবে পরবর্তী ১ সপ্তাহ পর্যন্ত ফাইলটি যতবারই Requote-এ আসুক না কেন, এই গ্রুপের আর কোনো কোম্পানি থেকে প্রাইস দেওয়া যাবে না।"
      ]
    },
    {
      name: "AXA / Swiftcover / Moja / Moja Essential",
      tags: ["axa", "swiftcover", "moja"],
      branch_priority: [],
      doc_extensions: [
        "Swiftcover & AXA: এই ইন্সুরেন্সে অন্য গাড়ি ড্রাইভ করার ক্ষেত্রে রেস্ট্রিকশন রয়েছে—X Driving other cars (third party cover only)।",
        "Moja Comprehensive Cover: মোজা ইন্সুরেন্সের ক্ষেত্রে স্পষ্টভাবে উল্লেখ থাকে: Policyholder NOT entitled to drive other cars।"
      ],
      common_rules: [
        "কোটেশন সেভ (Save) দিতে হবে। এই কোম্পানির প্রাইস আপডেট দেওয়ার সময় আপডেট লিস্টে অবশ্যই Occupations এবং Industry আপডেট করে দিতে হবে।"
      ]
    },
    {
      name: "Sainsbury's Bank / Sainsbury's Bank Plus",
      tags: ["sainsbury", "sainsburys"],
      branch_priority: [],
      doc_extensions: [
        "DOC Restriction (Critical): ব্যাংক ইন্সুরেন্সগুলোর মধ্যে Sainsbury's Bank এবং Sainsbury's Bank Plus পলিসিহোল্ডারকে অন্য কোনো গাড়ি ড্রাইভ করার সুবিধা বা DOC অফার করে না (Except Sainsbury's)।"
      ],
      common_rules: [
        "রেফারেন্স নম্বর সবসময় ওয়েবসাইটের ভেতর থেকে সংগ্রহ করতে হবে।"
      ]
    },
    {
      name: "Sheffield & Swan Drive (Special Conditions)",
      tags: ["sheffield", "swan drive", "swandrive"],
      branch_priority: [],
      doc_extensions: [],
      common_rules: [
        "[Sheffield - 20/01/2025] Sheffield fully flexible for young driver.",
        "[Swan Drive - 12/05/2025] Please treat swan drive's files as super flexible."
      ]
    }
  ]
};
