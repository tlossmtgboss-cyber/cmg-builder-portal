/**
 * Aria Widget — CMG Builder Portal AI Chat Assistant
 * Self-contained ES5-compatible IIFE
 * Design: CMG Home Loans cream/forest-green/gold palette
 */
(function() {
  'use strict';

  // ── Guard: only init if user is logged in ──
  if (!localStorage.getItem('builderAccount')) return;

  // ── Configuration ──
  var API_BASE = 'https://api.perenniaai.com/api/v1';
  var MAX_HISTORY = 50;
  var SESSION_KEY = 'ariaChatHistory';
  var SESSION_ID_KEY = 'ariaSessionId';
  var WELCOME_SHOWN_KEY = 'ariaWelcomeShown';

  // ── State ──
  var isOpen = false;
  var isTyping = false;
  var messages = [];
  var sessionId = '';
  var previousFocusEl = null;

  // ── Utility ──
  function generateUUID() {
    var d = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function getTimestamp() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Session ID ──
  function getSessionId() {
    var id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  // ── Message History ──
  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        messages = JSON.parse(raw);
        if (!Array.isArray(messages)) messages = [];
        if (messages.length > MAX_HISTORY) {
          messages = messages.slice(messages.length - MAX_HISTORY);
        }
      }
    } catch (e) {
      messages = [];
    }
  }

  function saveHistory() {
    try {
      if (messages.length > MAX_HISTORY) {
        messages = messages.slice(messages.length - MAX_HISTORY);
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch (e) { /* quota exceeded, ignore */ }
  }

  function clearHistory() {
    messages = [];
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(WELCOME_SHOWN_KEY);
  }

  // ── Listen for sign-out ──
  window.addEventListener('storage', function(e) {
    if (e.key === 'builderAccount' && !e.newValue) {
      clearHistory();
      if (isOpen) togglePanel();
      var widget = document.getElementById('aria-widget-root');
      if (widget) widget.style.display = 'none';
    }
  });

  // ── Context Detection ──
  function detectContext() {
    var path = window.location.pathname;
    var page = 'unknown';
    if (path.indexOf('portal') !== -1) page = 'portal';
    else if (path.indexOf('application') !== -1) page = 'application';
    else if (path.indexOf('documents') !== -1) page = 'documents';
    else if (path.indexOf('review') !== -1) page = 'review';

    var step = 0;
    if (page === 'application') {
      var stepEl = document.getElementById('stepLabel');
      if (stepEl) step = parseInt(stepEl.textContent, 10) || 0;
    }

    return { page: page, step: step };
  }

  function getAccountData() {
    try {
      return JSON.parse(localStorage.getItem('builderAccount') || '{}');
    } catch (e) {
      return {};
    }
  }

  function getFormData() {
    var data = {};
    var fields = document.querySelectorAll('[data-field]');
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var key = f.getAttribute('data-field');
      if (key && f.value) data[key] = f.value;
    }
    return data;
  }

  // ── Quick Action Chips ──
  function getQuickActions() {
    var ctx = detectContext();
    var page = ctx.page;
    var step = ctx.step;

    if (page === 'portal') {
      return [
        "What's my status?",
        "Schedule consultation",
        "What should I do next?"
      ];
    }

    if (page === 'application') {
      if (step >= 1 && step <= 2) {
        return ["Help with this section", "What's required?"];
      }
      if (step === 3) {
        return ["Search for a person's info", "Help with this section"];
      }
      if (step === 4) {
        return ["Help with this section", "What's required?"];
      }
      if (step === 5) {
        return ["Help with this section", "What's required?"];
      }
      if (step === 6) {
        return ["Help with this section", "What's required?"];
      }
      if (step === 7) {
        return ["Find bank contact info", "Help with this section"];
      }
      if (step === 8) {
        return ["Search for trade reference", "Help with this section"];
      }
      if (step === 9) {
        return ["Find supplier info", "Am I ready to submit?"];
      }
      return ["Help with this section", "What's required?"];
    }

    if (page === 'documents') {
      return [
        "What documents do I need?",
        "Insurance requirements",
        "Help with this upload"
      ];
    }

    if (page === 'review') {
      return [
        "Explain e-sign process",
        "Help with W-9",
        "Schedule a call"
      ];
    }

    return ["What can you help with?", "Schedule consultation"];
  }

  // ── Smart Client-Side Response Engine ──
  var responsePatterns = [
    {
      keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings'],
      response: function() {
        var account = getAccountData();
        var name = account.companyName || account.contactFirst || '';
        var greeting = name ? ('Hi' + (name ? ', ' + name : '') + '!') : 'Hi there!';
        return greeting + " I'm Aria, your CMG Builder Portal assistant. I can help you with your application, search for reference information, explain requirements, or schedule a consultation. What can I help you with?";
      }
    },
    {
      keywords: ['status', 'where am i', 'progress', 'how far', 'what stage'],
      response: function() {
        var account = getAccountData();
        var ctx = detectContext();
        var status = account.applicationStatus || account.status || 'not started';
        var company = account.companyName || 'your company';
        var r = 'Here is your current status for ' + company + ':\n\n';
        r += 'Application status: ' + status + '\n';
        if (ctx.page === 'application') {
          r += 'You are currently on Step ' + ctx.step + ' of 9 in the application.\n';
        }
        if (account.documentsUploaded) {
          r += 'Documents uploaded: ' + account.documentsUploaded + '\n';
        }
        r += '\nWould you like to know what to do next?';
        return r;
      }
    },
    {
      keywords: ['next step', 'what next', 'what should i do', 'to do', 'what do i need to do'],
      response: function() {
        var ctx = detectContext();
        var account = getAccountData();
        if (ctx.page === 'portal') {
          if (!account.applicationStarted) {
            return "Your next step is to start the Builder Application. It is a 9-step process covering your company info, experience, and references. Click \"Start Application\" to begin. I will be here to help along the way.";
          }
          return "It looks like your application is in progress. Here is what I recommend:\n\n1. Continue your application where you left off\n2. Upload any required documents\n3. Schedule a consultation with your CMG lending team if you have questions\n\nWould you like help with any of these?";
        }
        if (ctx.page === 'application') {
          return getStepHelp(ctx.step);
        }
        if (ctx.page === 'documents') {
          return "Review the list of required documents and upload each one. The 12 core documents are listed in order of priority. Once all required docs are uploaded, you can proceed to the review stage.";
        }
        if (ctx.page === 'review') {
          return "You are at the review stage. Here is what to do:\n\n1. Review all your application details for accuracy\n2. Complete the W-9 form\n3. Review and e-sign any required documents\n4. Schedule a final consultation call if needed\n\nWould you like me to explain any of these steps?";
        }
        return "I recommend starting with your Builder Application if you have not already. From the portal dashboard, you can begin the 9-step application, upload documents, or schedule a consultation.";
      }
    },
    {
      keywords: ['application', 'nine step', '9 step', '9-step', 'steps', 'process', 'how does it work', 'explain the process'],
      response: function() {
        return "The CMG Builder Application has 9 steps:\n\n" +
          "1. Project & Borrower - Project address, borrower info, routing questions\n" +
          "2. Company Information - Legal entity name, EIN, DBA, address, primary contact\n" +
          "3. Principals & Officers - Ownership and executive authority details\n" +
          "4. Background - Litigation history, liens, bankruptcy, workers comp\n" +
          "5. Construction Experience - Years in business, project types, in-house trades\n" +
          "6. Project History - 5-year project history and 3-year sales volume\n" +
          "7. Banking References - At least 1 lender relationship required\n" +
          "8. Trade References - 3 subcontractor references\n" +
          "9. Supplier References - 3 suppliers (at least 1 primary lumber supplier)\n\n" +
          "You can save your progress at any time and come back later. Would you like help with a specific step?";
      }
    },
    {
      keywords: ['document', 'docs', 'what documents', 'upload', 'paperwork', 'files needed'],
      response: function() {
        return "Here are the 12 required documents for your builder application:\n\n" +
          "INSURANCE:\n" +
          "1. General Liability Insurance - Min $1M coverage, CMG as Additional Insured\n" +
          "2. Workers' Compensation Insurance - Active policy or state-filed exemption\n" +
          "3. Builder's Risk Insurance - Coverage >= contract price, CMG as Certificate Holder\n\n" +
          "LICENSING:\n" +
          "4. Contractor License - Current through projected closing date\n\n" +
          "TAX:\n" +
          "5. W-9 Form - Rev. March 2024, SSN or EIN required\n\n" +
          "PROJECT:\n" +
          "6. Plans - Foundation, floor, elevation, wall sections (initialed every page)\n" +
          "7. Specifications - Separate from plans, signed and dated\n" +
          "8. Site/Plot Plan - Borrower names, address, property lines\n" +
          "9. Construction Contract - Fully executed, fixed-price, all addenda\n" +
          "10. Building Permit - Prior to closing or first draw\n\n" +
          "FINANCIAL:\n" +
          "11. Line-Item Budget / Draw Schedule - Signed, no misc lines, matches contract\n" +
          "12. Bank-Verified Wire Instructions - Required prior to closing\n\n" +
          "Conditional:\n" +
          "- HOA Approval (if in HOA community)\n" +
          "- Texas Confirmation (if TX property)\n\n" +
          "Need help with a specific document?";
      }
    },
    {
      keywords: ['insurance', 'gl', 'general liability', 'workers comp', 'wc', 'builder risk', 'builders risk', 'coverage'],
      response: function() {
        return "CMG requires three types of insurance:\n\n" +
          "General Liability (GL):\n" +
          "- Minimum $1M per occurrence / $2M aggregate\n" +
          "- Must name CMG Home Loans as additional insured\n" +
          "- Current certificate of insurance required\n\n" +
          "Workers Compensation (WC):\n" +
          "- Required in most states if you have employees\n" +
          "- If exempt, provide a state exemption letter\n" +
          "- Coverage must be active through project completion\n\n" +
          "Builder's Risk:\n" +
          "- Course-of-construction coverage\n" +
          "- Must cover the full contract amount\n" +
          "- CMG must be named as loss payee\n" +
          "- Required before first draw\n\n" +
          "Would you like help locating your insurance documents?";
      }
    },
    {
      keywords: ['w-9', 'w9', 'tax form', 'tax id', 'tin'],
      response: function() {
        return "The W-9 (Request for Taxpayer Identification Number) is required for all builders:\n\n" +
          "What you need:\n" +
          "- Legal business name (must match your EIN)\n" +
          "- Business entity type (LLC, S-Corp, C-Corp, Partnership, Sole Prop)\n" +
          "- EIN (Employer Identification Number)\n" +
          "- Business address\n" +
          "- Signature and date\n\n" +
          "Tax classifications:\n" +
          "- Individual/Sole Proprietor - use SSN or EIN\n" +
          "- LLC - check the appropriate tax classification box\n" +
          "- C-Corporation or S-Corporation - check the matching box\n" +
          "- Partnership - check Partnership box\n\n" +
          "The W-9 is available in the Review section for e-signature. Would you like me to take you there?";
      }
    },
    {
      keywords: ['ein', 'employer identification', 'federal tax id', 'tax number'],
      response: function() {
        return "An EIN (Employer Identification Number) is a 9-digit number (XX-XXXXXXX) assigned by the IRS to identify your business for tax purposes.\n\n" +
          "Where to find yours:\n" +
          "- IRS confirmation letter (CP 575 or 147C)\n" +
          "- Previous tax returns (Form 1120, 1065, or 1040 Schedule C)\n" +
          "- Your bank account setup documents\n" +
          "- Contact your CPA or accountant\n\n" +
          "If you do not have an EIN:\n" +
          "- Apply online at irs.gov/ein (free, takes ~15 minutes)\n" +
          "- You will receive it immediately after completing the application\n\n" +
          "Your EIN goes in Step 2 (Company Information) of the application.";
      }
    },
    {
      keywords: ['e-sign', 'esign', 'electronic signature', 'sign electronically', 'digital signature'],
      response: function() {
        return "CMG uses compliant electronic signatures under the ESIGN Act (Electronic Signatures in Global and National Commerce Act):\n\n" +
          "What gets e-signed:\n" +
          "- Builder Application Agreement\n" +
          "- W-9 Tax Form\n" +
          "- Authorization to Release Information\n" +
          "- Construction Lending Agreement\n\n" +
          "How it works:\n" +
          "1. Review each document in the Review section\n" +
          "2. Click to apply your electronic signature\n" +
          "3. All signatures are timestamped and legally binding\n" +
          "4. You receive a copy of all signed documents via email\n\n" +
          "Your e-signature is legally equivalent to a handwritten signature under federal law.";
      }
    },
    {
      keywords: ['draw schedule', 'disbursement', 'construction to perm', 'construction loan', 'construction-to-perm', 'how draws work', 'draw process'],
      response: function() {
        return "Key construction lending terms:\n\n" +
          "Draw Schedule:\n" +
          "A predetermined plan for releasing funds at specific construction milestones. Typical stages include foundation, framing, dry-in, rough mechanicals, drywall, trim, and final. Each draw requires an inspection.\n\n" +
          "Disbursement:\n" +
          "The actual release of funds from the construction loan. Disbursements follow draw requests after inspection approval. Funds are typically wired within 2-3 business days of approval.\n\n" +
          "Construction-to-Permanent (CTP):\n" +
          "A single-close loan that converts from a construction loan to a permanent mortgage upon project completion. Benefits include one closing, one set of closing costs, and a locked permanent rate.\n\n" +
          "Would you like more details on any of these?";
      }
    },
    {
      keywords: ['timeline', 'how long', 'review time', 'when will i hear', 'turnaround', 'how fast'],
      response: function() {
        return "Typical timelines for the CMG builder approval process:\n\n" +
          "- Application review: 3-5 business days after complete submission\n" +
          "- Document review: 1-2 business days per document set\n" +
          "- Full underwriting: 5-10 business days\n" +
          "- Conditional approval to clear-to-close: varies by conditions\n\n" +
          "Tips to speed things up:\n" +
          "1. Complete all 9 application steps in one session if possible\n" +
          "2. Upload all 12 required documents before submitting\n" +
          "3. Ensure insurance certificates name CMG correctly\n" +
          "4. Have your CPA prepare financial statements in advance\n\n" +
          "Would you like to schedule a consultation to discuss your timeline?";
      }
    },
    {
      keywords: ['schedule', 'consultation', 'call', 'appointment', 'meeting', 'talk to someone', 'speak with', 'book a call'],
      response: function() {
        var ctx = detectContext();
        if (ctx.page === 'portal') {
          setTimeout(function() {
            var btn = document.getElementById('openScheduleModal');
            if (btn) btn.click();
          }, 500);
          return "I am opening the scheduling window for you now. You can pick a time that works best for your CMG lending team consultation.";
        }
        if (ctx.page === 'review') {
          return "You can schedule a consultation from the Review page. Look for the scheduling section, or head back to your portal dashboard where the full calendar is available.";
        }
        return "To schedule a consultation with your CMG lending team, head to your portal dashboard and click \"Schedule Consultation.\" You can pick any available time slot.\n\nWould you like me to take you to the portal?";
      }
    },
    {
      keywords: ['help', 'assist', 'this section', 'explain this', 'what is this'],
      response: function() {
        var ctx = detectContext();
        if (ctx.page === 'application') {
          return getStepHelp(ctx.step);
        }
        if (ctx.page === 'documents') {
          return "This is the document upload center. Upload each required document by clicking the upload area or dragging files. Accepted formats are PDF, JPG, and PNG. Each document has a maximum size of 10MB.\n\nNeed help with a specific document type?";
        }
        if (ctx.page === 'review') {
          return "The review page lets you verify all your application information, complete e-signatures, and submit your package. Review each section carefully before signing.\n\nNeed help with a specific part?";
        }
        return "I can help you with:\n- Filling out the builder application\n- Understanding document requirements\n- Searching for reference information\n- Explaining construction lending terms\n- Scheduling a consultation\n\nWhat would you like to know?";
      }
    },
    {
      keywords: ['required', 'mandatory', 'need to fill', 'what fields'],
      response: function() {
        var ctx = detectContext();
        if (ctx.page === 'application') {
          return getStepRequirements(ctx.step);
        }
        return "Required fields are marked with a red asterisk (*). You must complete all required fields in each step before moving to the next one. Your progress is saved automatically.\n\nWould you like me to explain what is required for a specific step?";
      }
    },
    {
      keywords: ['search for', 'find', 'look up', 'lookup', 'search'],
      response: function() {
        return null; // handled by search flow
      }
    },
    {
      keywords: ['ready to submit', 'ready', 'can i submit', 'complete'],
      response: function() {
        var ctx = detectContext();
        if (ctx.page === 'application' && ctx.step === 9) {
          return "Before submitting, make sure you have completed:\n\n" +
            "1. All 9 steps of the application (check for any red indicators)\n" +
            "2. All required fields marked with * in each step\n" +
            "3. At least 1 principal/officer\n" +
            "4. At least 1 banking reference\n" +
            "5. 3 trade references (subcontractors)\n" +
            "6. 3 supplier references (1 must be primary lumber)\n\n" +
            "After the application, you will also need to:\n" +
            "- Upload all 12 required documents\n" +
            "- Complete e-signatures in the Review section\n\n" +
            "Would you like me to check what you still have left?";
        }
        return "To be ready for submission, you need:\n1. Complete 9-step builder application\n2. Upload all 12 required documents\n3. Complete e-signatures in the Review section\n\nWould you like details on any of these?";
      }
    }
  ];

  function getStepHelp(step) {
    var help = {
      1: "Step 1 - Project & Borrower:\n\nThis step captures the construction project details and borrower information.\n\nRequired fields:\n- Project street address, city, state, zip\n- Borrower full name\n- Estimated construction duration (months)\n- Contract amount\n\nOptional: Co-borrower name\n\nTip: The contract amount should match your signed construction agreement.",
      2: "Step 2 - Company Information:\n\nProvide your construction company's legal details.\n\nRequired fields:\n- Company legal name (must match EIN records)\n- EIN (XX-XXXXXXX format)\n- Company street address, city, state, zip\n- Primary contact: first name, last name, phone, email\n\nOptional: DBA (Doing Business As), Parent Company\n\nTip: Your company name must match exactly what is on file with the IRS.",
      3: "Step 3 - Principals & Officers:\n\nList everyone with ownership or executive authority.\n\nRequired for each principal:\n- Full name and title\n- Ownership percentage (must total 100%)\n- Years of experience\n- Email and phone\n\nOptional: Home address\n\nYou must add at least one principal. Use the + button to add more. Would you like me to search for a person's information?",
      4: "Step 4 - Background:\n\nDisclosure questions about your company and principals.\n\nYou must answer yes or no to:\n- Any pending or past litigation\n- Any outstanding liens or judgments\n- Any bankruptcy in the last 7 years\n- Workers compensation coverage status\n\nIf you answer 'Yes' to any question, a text field appears for a brief explanation. Be honest and concise - these disclosures are verified during underwriting.",
      5: "Step 5 - Construction Experience:\n\nDetail your building track record.\n\nRequired:\n- Years in business under this company\n\nProject categories (fill in what applies):\n- Residential new construction: starts, completions, in-progress, avg size\n- Residential renovation: same metrics\n- Commercial: same metrics\n\nAlso list any trades you perform in-house (framing, finish carpentry, etc.).",
      6: "Step 6 - Project History:\n\nYour financial track record over recent years.\n\nProvide:\n- 3-year sales history (total sales $ and projects completed per year)\n- This helps underwriting assess volume consistency\n\nTip: Have your CPA or bookkeeper verify these numbers for accuracy.",
      7: "Step 7 - Banking References:\n\nProvide at least one banking/lending relationship.\n\nRequired for primary reference:\n- Lender name and loan officer\n- Phone and email\n- Years as client\n\nOptional: Second banking reference and street address\n\nWould you like me to help find bank contact information?",
      8: "Step 8 - Trade References:\n\nProvide 3 subcontractor references.\n\nRequired for each:\n- Subcontractor company name\n- Trade specialty (Electrical, HVAC, Plumbing, etc.)\n- Contact person name\n- Relationship length (years)\n- Phone number\n\nOptional: Email and address\n\nWould you like me to search for a trade reference?",
      9: "Step 9 - Supplier References:\n\nProvide 3 supplier references. At least one must be your primary lumber supplier.\n\nRequired for each:\n- Supplier name\n- Trade/material type\n- Contact person\n- Relationship length (years)\n- Phone number\n\nOptional: Email, address, additional comments\n\nWould you like me to help find supplier information?"
    };
    return help[step] || "I can help with the current application step. What specific question do you have?";
  }

  function getStepRequirements(step) {
    var reqs = {
      1: "Step 1 required fields:\n- Project Street Address *\n- City *\n- State *\n- Zip *\n- Borrower Full Name *\n- Estimated Duration (months) *\n- Contract Amount *",
      2: "Step 2 required fields:\n- Company Legal Name *\n- EIN *\n- Company Street Address *\n- City *\n- State *\n- Zip *\n- Contact First Name *\n- Contact Last Name *\n- Contact Phone *\n- Contact Email *",
      3: "Step 3 required fields (per principal):\n- Full Name *\n- Title *\n- Ownership % *\n- Years Experience *\n- Email *\n- Phone *\n\nAt least one principal is required.",
      4: "Step 4 required fields:\n- Litigation disclosure (Yes/No) *\n- Liens disclosure (Yes/No) *\n- Bankruptcy disclosure (Yes/No) *\n- Workers Comp status *\n\nIf Yes, a brief explanation is required for each.",
      5: "Step 5 required fields:\n- Years in Business *\n\nProject metrics are optional but recommended for at least one category.",
      6: "Step 6 required fields:\n- At least one year of sales history\n- Total sales amount and projects completed per year",
      7: "Step 7 required fields (primary bank):\n- Lender Name *\n- Loan Officer *\n- Phone *\n- Email *\n- Years as Client *\n\nSecond banking reference is optional.",
      8: "Step 8 required fields (per trade, 3 required):\n- Subcontractor Name *\n- Trade *\n- Contact Person *\n- Relationship (years) *\n- Phone *",
      9: "Step 9 required fields (per supplier, 3 required):\n- Supplier Name *\n- Trade/Material *\n- Contact Person *\n- Relationship (years) *\n- Phone *\n\nAt least one must be a primary lumber supplier."
    };
    return reqs[step] || "Required fields are marked with a red asterisk (*). Complete all required fields before proceeding.";
  }

  // ── Search Detection ──
  function isSearchRequest(text) {
    var lower = text.toLowerCase();
    var searchTriggers = ['search for', 'find ', 'look up', 'lookup', 'can you find', 'help me find', 'search '];
    for (var i = 0; i < searchTriggers.length; i++) {
      if (lower.indexOf(searchTriggers[i]) !== -1) return true;
    }
    return false;
  }

  function extractSearchQuery(text) {
    var lower = text.toLowerCase();
    var triggers = ['search for ', 'find ', 'look up ', 'lookup ', 'can you find ', 'help me find '];
    for (var i = 0; i < triggers.length; i++) {
      var idx = lower.indexOf(triggers[i]);
      if (idx !== -1) {
        return text.substring(idx + triggers[i].length).trim();
      }
    }
    return text;
  }

  function detectSearchType() {
    var ctx = detectContext();
    if (ctx.page === 'application') {
      if (ctx.step === 3) return 'principal';
      if (ctx.step === 7) return 'bank';
      if (ctx.step === 8) return 'trade';
      if (ctx.step === 9) return 'supplier';
    }
    return 'general';
  }

  // ── Pattern Matching Engine ──
  function findBestResponse(text) {
    var lower = text.toLowerCase();

    // Check search first
    if (isSearchRequest(lower)) {
      return null; // signal to handle as search
    }

    var bestScore = 0;
    var bestPattern = null;

    for (var i = 0; i < responsePatterns.length; i++) {
      var pattern = responsePatterns[i];
      var score = 0;
      for (var j = 0; j < pattern.keywords.length; j++) {
        if (lower.indexOf(pattern.keywords[j]) !== -1) {
          score += pattern.keywords[j].length; // longer matches score higher
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestPattern = pattern;
      }
    }

    if (bestPattern && bestScore > 0) {
      var resp = bestPattern.response();
      if (resp !== null) return resp;
    }

    // Fallback
    return "I am not sure about that specific topic. Would you like to:\n\n" +
      "- Schedule a call with your CMG lending team\n" +
      "- Get help with a specific application step\n" +
      "- Learn about document requirements\n\n" +
      "Just let me know how I can help!";
  }

  // ── Auto-fill logic ──
  function autoFillFields(type, data) {
    var ctx = detectContext();
    if (ctx.page !== 'application') return false;

    var filled = false;

    if (type === 'bank' && ctx.step === 7) {
      var bankRows = document.querySelectorAll('[data-bank-ref]');
      // Find first empty bank row
      var targetRow = null;
      for (var i = 0; i < bankRows.length; i++) {
        var nameField = bankRows[i].querySelector('[data-bank="lenderName"]');
        if (nameField && !nameField.value) {
          targetRow = bankRows[i];
          break;
        }
      }
      if (!targetRow && bankRows.length > 0) targetRow = bankRows[0];
      if (targetRow) {
        var bankMap = {
          name: 'lenderName', contact: 'loanOfficer', phone: 'phone',
          email: 'email', address: 'address', city: 'city', state: 'state', zip: 'zip'
        };
        for (var key in bankMap) {
          if (data[key]) {
            var el = targetRow.querySelector('[data-bank="' + bankMap[key] + '"]');
            if (el) { el.value = data[key]; filled = true; }
          }
        }
      }
    }

    if (type === 'trade' && ctx.step === 8) {
      var tradeRows = document.querySelectorAll('[data-trade-idx]');
      var targetTrade = null;
      for (var ti = 0; ti < tradeRows.length; ti++) {
        var tn = tradeRows[ti].querySelector('[data-trade="name"]');
        if (tn && !tn.value) { targetTrade = tradeRows[ti]; break; }
      }
      if (!targetTrade && tradeRows.length > 0) targetTrade = tradeRows[0];
      if (targetTrade) {
        var tradeMap = { name: 'name', trade: 'trade', contact: 'contact', phone: 'phone', email: 'email' };
        for (var tk in tradeMap) {
          if (data[tk]) {
            var te = targetTrade.querySelector('[data-trade="' + tradeMap[tk] + '"]');
            if (te) { te.value = data[tk]; filled = true; }
          }
        }
      }
    }

    if (type === 'supplier' && ctx.step === 9) {
      var supplierRows = document.querySelectorAll('[data-supplier-idx]');
      var targetSupplier = null;
      for (var si = 0; si < supplierRows.length; si++) {
        var sn = supplierRows[si].querySelector('[data-supplier="name"]');
        if (sn && !sn.value) { targetSupplier = supplierRows[si]; break; }
      }
      if (!targetSupplier && supplierRows.length > 0) targetSupplier = supplierRows[0];
      if (targetSupplier) {
        var suppMap = {
          name: 'name', material: 'material', contact: 'contact',
          phone: 'phone', email: 'email', address: 'address', city: 'city', state: 'state', zip: 'zip'
        };
        for (var sk in suppMap) {
          if (data[sk]) {
            var se = targetSupplier.querySelector('[data-supplier="' + suppMap[sk] + '"]');
            if (se) { se.value = data[sk]; filled = true; }
          }
        }
      }
    }

    if (type === 'principal' && ctx.step === 3) {
      var principalRows = document.querySelectorAll('[data-principal-idx]');
      var targetPrincipal = null;
      for (var pi = 0; pi < principalRows.length; pi++) {
        var pn = principalRows[pi].querySelector('[data-principal="name"]');
        if (pn && !pn.value) { targetPrincipal = principalRows[pi]; break; }
      }
      if (!targetPrincipal && principalRows.length > 0) targetPrincipal = principalRows[0];
      if (targetPrincipal) {
        var princMap = {
          name: 'name', title: 'title', email: 'email', phone: 'phone',
          address: 'address', city: 'city', state: 'state', zip: 'zip'
        };
        for (var pk in princMap) {
          if (data[pk]) {
            var pe = targetPrincipal.querySelector('[data-principal="' + princMap[pk] + '"]');
            if (pe) { pe.value = data[pk]; filled = true; }
          }
        }
      }
    }

    return filled;
  }

  // ── API Integration ──
  function sendToAPI(text, callback) {
    var ctx = detectContext();
    var account = getAccountData();
    var payload = {
      message: text,
      sessionId: getSessionId(),
      context: {
        page: ctx.page,
        step: ctx.step,
        formData: getFormData(),
        account: account
      }
    };

    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/builder/aria-chat', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 10000;

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var resp = JSON.parse(xhr.responseText);
            callback(null, resp);
          } catch (e) {
            callback(e, null);
          }
        } else {
          callback(new Error('API error: ' + xhr.status), null);
        }
      };

      xhr.onerror = function() {
        callback(new Error('Network error'), null);
      };

      xhr.ontimeout = function() {
        callback(new Error('Timeout'), null);
      };

      xhr.send(JSON.stringify(payload));
    } catch (e) {
      callback(e, null);
    }
  }

  function searchAPI(query, type, callback) {
    var ctx = detectContext();
    var payload = {
      query: query,
      type: type,
      context: {
        page: ctx.page,
        step: ctx.step
      }
    };

    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/builder/aria-search', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 10000;

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var resp = JSON.parse(xhr.responseText);
            callback(null, resp);
          } catch (e) {
            callback(e, null);
          }
        } else {
          callback(new Error('API error: ' + xhr.status), null);
        }
      };

      xhr.onerror = function() { callback(new Error('Network error'), null); };
      xhr.ontimeout = function() { callback(new Error('Timeout'), null); };

      xhr.send(JSON.stringify(payload));
    } catch (e) {
      callback(e, null);
    }
  }

  // ── DOM References ──
  var els = {};

  // ── Inject Styles ──
  function injectStyles() {
    var style = document.createElement('style');
    style.id = 'aria-widget-styles';
    style.textContent = [
      '/* Aria Widget Styles */',
      '@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap");',
      '',
      '#aria-widget-root {',
      '  --aw-brand: #1F3D2E;',
      '  --aw-brand-hover: #2A4F3D;',
      '  --aw-gold: #B8924A;',
      '  --aw-cream: #FAF7F1;',
      '  --aw-cream-50: #FDFBF7;',
      '  --aw-cream-200: #F2EDE2;',
      '  --aw-cream-300: #ECE6D8;',
      '  --aw-cream-400: #D8D0BD;',
      '  --aw-text: #1A1F1B;',
      '  --aw-text-secondary: #4F554E;',
      '  --aw-text-muted: #8B8A7E;',
      '  --aw-surface: #FFFFFF;',
      '  --aw-elevated: #F2EDE2;',
      '  --aw-border: #ECE6D8;',
      '  --aw-border-strong: #D8D0BD;',
      '  --aw-font-display: "Fraunces", "Georgia", serif;',
      '  --aw-font-body: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  --aw-font-mono: "Geist Mono", "SF Mono", "Consolas", monospace;',
      '  font-family: var(--aw-font-body);',
      '  box-sizing: border-box;',
      '  line-height: 1.5;',
      '}',
      '',
      '#aria-widget-root *, #aria-widget-root *::before, #aria-widget-root *::after {',
      '  box-sizing: border-box;',
      '}',
      '',
      '/* FAB */',
      '#aria-fab {',
      '  position: fixed;',
      '  bottom: 24px;',
      '  right: 24px;',
      '  bottom: calc(24px + env(safe-area-inset-bottom, 0px));',
      '  right: calc(24px + env(safe-area-inset-right, 0px));',
      '  width: 56px;',
      '  height: 56px;',
      '  border-radius: 50%;',
      '  background: var(--aw-brand);',
      '  border: none;',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  z-index: 99998;',
      '  box-shadow: 0 4px 16px rgba(31,61,46,0.25);',
      '  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;',
      '  transform: scale(0);',
      '  animation: ariaFabEntrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards;',
      '  outline: none;',
      '}',
      '',
      '#aria-fab:hover {',
      '  background: var(--aw-brand-hover);',
      '  box-shadow: 0 4px 16px rgba(31,61,46,0.3), 0 0 0 3px rgba(184,146,74,0.35);',
      '  transform: scale(1.05);',
      '}',
      '',
      '#aria-fab:focus-visible {',
      '  box-shadow: 0 4px 16px rgba(31,61,46,0.3), 0 0 0 3px rgba(184,146,74,0.6);',
      '  transform: scale(1.05);',
      '}',
      '',
      '#aria-fab:active {',
      '  transform: scale(0.96);',
      '}',
      '',
      '#aria-fab svg {',
      '  width: 26px;',
      '  height: 26px;',
      '  fill: #FFFFFF;',
      '  transition: transform 0.2s ease;',
      '}',
      '',
      '#aria-fab.aria-open svg.aria-icon-chat { display: none; }',
      '#aria-fab.aria-open svg.aria-icon-close { display: block; }',
      '#aria-fab:not(.aria-open) svg.aria-icon-chat { display: block; }',
      '#aria-fab:not(.aria-open) svg.aria-icon-close { display: none; }',
      '',
      '#aria-fab .aria-fab-pulse {',
      '  position: absolute;',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  border-radius: 50%;',
      '  animation: ariaPulse 2s ease-in-out 1s 3;',
      '  pointer-events: none;',
      '}',
      '',
      '@keyframes ariaFabEntrance {',
      '  from { transform: scale(0); }',
      '  to { transform: scale(1); }',
      '}',
      '',
      '@keyframes ariaPulse {',
      '  0%, 100% { box-shadow: 0 0 0 0 rgba(184,146,74,0.4); }',
      '  50% { box-shadow: 0 0 0 12px rgba(184,146,74,0); }',
      '}',
      '',
      '/* Panel */',
      '#aria-panel {',
      '  position: fixed;',
      '  bottom: calc(90px + env(safe-area-inset-bottom, 0px));',
      '  right: calc(24px + env(safe-area-inset-right, 0px));',
      '  width: 380px;',
      '  max-height: 520px;',
      '  background: var(--aw-surface);',
      '  border-radius: 16px 16px 4px 16px;',
      '  box-shadow: 0 8px 32px rgba(31,61,46,0.15);',
      '  z-index: 99999;',
      '  display: none;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '  opacity: 0;',
      '  transform: translateY(20px);',
      '  transition: opacity 0.25s ease, transform 0.25s ease;',
      '}',
      '',
      '#aria-panel.aria-visible {',
      '  display: flex;',
      '  opacity: 0;',
      '  transform: translateY(20px);',
      '}',
      '',
      '#aria-panel.aria-visible.aria-shown {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',
      '',
      '/* Header */',
      '#aria-panel-header {',
      '  background: var(--aw-brand);',
      '  padding: 14px 18px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  flex-shrink: 0;',
      '}',
      '',
      '.aria-header-left {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '}',
      '',
      '.aria-avatar {',
      '  width: 32px;',
      '  height: 32px;',
      '  border-radius: 50%;',
      '  background: rgba(255,255,255,0.15);',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  font-family: var(--aw-font-display);',
      '  font-size: 15px;',
      '  font-weight: 600;',
      '  color: #FFFFFF;',
      '  position: relative;',
      '}',
      '',
      '.aria-avatar-status {',
      '  position: absolute;',
      '  bottom: -1px;',
      '  right: -1px;',
      '  width: 10px;',
      '  height: 10px;',
      '  border-radius: 50%;',
      '  background: #4ADE80;',
      '  border: 2px solid var(--aw-brand);',
      '}',
      '',
      '.aria-header-title {',
      '  font-family: var(--aw-font-display);',
      '  font-size: 16px;',
      '  font-weight: 500;',
      '  color: #FFFFFF;',
      '  line-height: 1.2;',
      '}',
      '',
      '.aria-header-sub {',
      '  font-family: var(--aw-font-body);',
      '  font-size: 11px;',
      '  color: rgba(250,247,241,0.7);',
      '  line-height: 1.2;',
      '  margin-top: 1px;',
      '}',
      '',
      '#aria-close-btn {',
      '  background: transparent;',
      '  border: none;',
      '  cursor: pointer;',
      '  color: rgba(255,255,255,0.7);',
      '  width: 30px;',
      '  height: 30px;',
      '  border-radius: 6px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: background 0.15s, color 0.15s;',
      '  font-size: 18px;',
      '  line-height: 1;',
      '  padding: 0;',
      '}',
      '',
      '#aria-close-btn:hover, #aria-close-btn:focus-visible {',
      '  background: rgba(255,255,255,0.15);',
      '  color: #FFFFFF;',
      '}',
      '',
      '/* Messages */',
      '#aria-messages {',
      '  flex: 1 1 auto;',
      '  overflow-y: auto;',
      '  padding: 14px;',
      '  background: var(--aw-cream-50);',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 10px;',
      '  min-height: 0;',
      '}',
      '',
      '#aria-messages::-webkit-scrollbar {',
      '  width: 5px;',
      '}',
      '#aria-messages::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '#aria-messages::-webkit-scrollbar-thumb {',
      '  background: var(--aw-cream-300);',
      '  border-radius: 3px;',
      '}',
      '',
      '.aria-msg {',
      '  display: flex;',
      '  flex-direction: column;',
      '  max-width: 82%;',
      '  animation: ariaMsgIn 0.2s ease;',
      '}',
      '',
      '.aria-msg-aria { align-self: flex-start; }',
      '.aria-msg-user { align-self: flex-end; }',
      '',
      '.aria-msg-bubble {',
      '  padding: 10px 14px;',
      '  font-size: 13px;',
      '  line-height: 1.55;',
      '  white-space: pre-wrap;',
      '  word-wrap: break-word;',
      '}',
      '',
      '.aria-msg-aria .aria-msg-bubble {',
      '  background: #F6F2EA;',
      '  color: var(--aw-text);',
      '  border-radius: 4px 12px 12px 12px;',
      '}',
      '',
      '.aria-msg-user .aria-msg-bubble {',
      '  background: var(--aw-brand);',
      '  color: #FFFFFF;',
      '  border-radius: 12px 12px 4px 12px;',
      '}',
      '',
      '.aria-msg-time {',
      '  font-family: var(--aw-font-mono);',
      '  font-size: 10px;',
      '  color: var(--aw-text-muted);',
      '  margin-top: 4px;',
      '  padding: 0 4px;',
      '}',
      '',
      '.aria-msg-user .aria-msg-time { text-align: right; }',
      '',
      '@keyframes ariaMsgIn {',
      '  from { opacity: 0; transform: translateY(8px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '',
      '/* Typing indicator */',
      '.aria-typing {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  padding: 10px 14px;',
      '  background: #F6F2EA;',
      '  border-radius: 4px 12px 12px 12px;',
      '  align-self: flex-start;',
      '  max-width: 82%;',
      '}',
      '',
      '.aria-typing-dot {',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: var(--aw-text-muted);',
      '  animation: ariaTypingBounce 1.2s infinite;',
      '}',
      '.aria-typing-dot:nth-child(2) { animation-delay: 0.15s; }',
      '.aria-typing-dot:nth-child(3) { animation-delay: 0.3s; }',
      '',
      '@keyframes ariaTypingBounce {',
      '  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }',
      '  30% { transform: translateY(-4px); opacity: 1; }',
      '}',
      '',
      '/* Search result card */',
      '.aria-search-result {',
      '  background: var(--aw-surface);',
      '  border: 1px solid var(--aw-border);',
      '  border-radius: 10px;',
      '  padding: 12px;',
      '  margin-top: 6px;',
      '}',
      '',
      '.aria-search-result-name {',
      '  font-family: var(--aw-font-display);',
      '  font-size: 14px;',
      '  font-weight: 500;',
      '  color: var(--aw-text);',
      '  margin-bottom: 6px;',
      '}',
      '',
      '.aria-search-result-detail {',
      '  font-size: 12px;',
      '  color: var(--aw-text-secondary);',
      '  line-height: 1.6;',
      '}',
      '',
      '.aria-search-result-detail span {',
      '  display: block;',
      '}',
      '',
      '.aria-autofill-btn {',
      '  display: inline-block;',
      '  margin-top: 8px;',
      '  padding: 6px 14px;',
      '  font-size: 12px;',
      '  font-weight: 500;',
      '  font-family: var(--aw-font-body);',
      '  color: #FFFFFF;',
      '  background: var(--aw-brand);',
      '  border: none;',
      '  border-radius: 6px;',
      '  cursor: pointer;',
      '  transition: background 0.15s;',
      '}',
      '.aria-autofill-btn:hover { background: var(--aw-brand-hover); }',
      '',
      '/* Quick Actions */',
      '#aria-quick-actions {',
      '  padding: 8px 14px;',
      '  display: flex;',
      '  gap: 6px;',
      '  overflow-x: auto;',
      '  flex-shrink: 0;',
      '  background: var(--aw-cream-50);',
      '  border-top: 1px solid var(--aw-border);',
      '  -webkit-overflow-scrolling: touch;',
      '}',
      '',
      '#aria-quick-actions::-webkit-scrollbar { height: 0; display: none; }',
      '',
      '.aria-chip {',
      '  flex-shrink: 0;',
      '  padding: 5px 12px;',
      '  font-size: 12px;',
      '  font-family: var(--aw-font-body);',
      '  color: var(--aw-text-secondary);',
      '  background: var(--aw-cream-200);',
      '  border: 1px solid var(--aw-cream-300);',
      '  border-radius: 100px;',
      '  cursor: pointer;',
      '  white-space: nowrap;',
      '  transition: background 0.15s, border-color 0.15s, color 0.15s;',
      '  line-height: 1.3;',
      '}',
      '',
      '.aria-chip:hover {',
      '  background: var(--aw-cream-300);',
      '  border-color: var(--aw-border-strong);',
      '  color: var(--aw-text);',
      '}',
      '',
      '/* Input Area */',
      '#aria-input-area {',
      '  display: flex;',
      '  align-items: center;',
      '  padding: 10px 14px;',
      '  gap: 8px;',
      '  background: var(--aw-surface);',
      '  border-top: 1px solid var(--aw-border);',
      '  flex-shrink: 0;',
      '}',
      '',
      '#aria-input {',
      '  flex: 1;',
      '  border: 1px solid var(--aw-border);',
      '  border-radius: 10px;',
      '  padding: 9px 14px;',
      '  font-size: 16px;',
      '  font-family: var(--aw-font-body);',
      '  color: var(--aw-text);',
      '  background: var(--aw-cream-50);',
      '  outline: none;',
      '  transition: border-color 0.15s;',
      '  line-height: 1.4;',
      '  -webkit-appearance: none;',
      '}',
      '',
      '#aria-input::placeholder {',
      '  color: var(--aw-text-muted);',
      '}',
      '',
      '#aria-input:focus {',
      '  border-color: var(--aw-brand);',
      '}',
      '',
      '#aria-send-btn {',
      '  width: 36px;',
      '  height: 36px;',
      '  border-radius: 10px;',
      '  border: none;',
      '  background: var(--aw-brand);',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  flex-shrink: 0;',
      '  transition: background 0.15s, transform 0.1s;',
      '  padding: 0;',
      '}',
      '',
      '#aria-send-btn:hover { background: var(--aw-brand-hover); }',
      '#aria-send-btn:active { transform: scale(0.93); }',
      '',
      '#aria-send-btn svg {',
      '  width: 16px;',
      '  height: 16px;',
      '  fill: #FFFFFF;',
      '}',
      '',
      '/* Mobile */',
      '@media (max-width: 480px) {',
      '  #aria-fab {',
      '    width: 52px;',
      '    height: 52px;',
      '    bottom: calc(16px + env(safe-area-inset-bottom, 0px));',
      '    right: calc(16px + env(safe-area-inset-right, 0px));',
      '  }',
      '  #aria-fab svg { width: 22px; height: 22px; }',
      '  #aria-panel {',
      '    left: 0;',
      '    right: 0;',
      '    bottom: 0;',
      '    width: auto;',
      '    max-height: 70vh;',
      '    border-radius: 16px 16px 0 0;',
      '  }',
      '  #aria-messages { padding: 10px; }',
      '  #aria-input-area { padding: 8px 10px; }',
      '  #aria-quick-actions { padding: 6px 10px; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Build DOM ──
  function buildWidget() {
    var root = document.createElement('div');
    root.id = 'aria-widget-root';

    // FAB
    var fab = document.createElement('button');
    fab.id = 'aria-fab';
    fab.setAttribute('role', 'button');
    fab.setAttribute('aria-label', 'Open Aria assistant');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('tabindex', '0');
    fab.innerHTML = [
      '<div class="aria-fab-pulse"></div>',
      '<svg class="aria-icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
      '  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>',
      '  <circle cx="8" cy="10" r="1.2"/>',
      '  <circle cx="12" cy="10" r="1.2"/>',
      '  <circle cx="16" cy="10" r="1.2"/>',
      '</svg>',
      '<svg class="aria-icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:none">',
      '  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
      '</svg>'
    ].join('');

    // Panel
    var panel = document.createElement('div');
    panel.id = 'aria-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Aria assistant chat');
    panel.setAttribute('aria-hidden', 'true');

    // Header
    var header = document.createElement('div');
    header.id = 'aria-panel-header';
    header.innerHTML = [
      '<div class="aria-header-left">',
      '  <div class="aria-avatar">',
      '    <span>A</span>',
      '    <div class="aria-avatar-status"></div>',
      '  </div>',
      '  <div>',
      '    <div class="aria-header-title">Aria</div>',
      '    <div class="aria-header-sub">CMG Builder Assistant</div>',
      '  </div>',
      '</div>'
    ].join('');

    var closeBtn = document.createElement('button');
    closeBtn.id = 'aria-close-btn';
    closeBtn.setAttribute('aria-label', 'Close assistant');
    closeBtn.setAttribute('tabindex', '0');
    closeBtn.innerHTML = '&#215;';
    header.appendChild(closeBtn);

    // Messages
    var messagesArea = document.createElement('div');
    messagesArea.id = 'aria-messages';
    messagesArea.setAttribute('role', 'log');
    messagesArea.setAttribute('aria-live', 'polite');

    // Quick Actions
    var quickActions = document.createElement('div');
    quickActions.id = 'aria-quick-actions';

    // Input Area
    var inputArea = document.createElement('div');
    inputArea.id = 'aria-input-area';

    var input = document.createElement('input');
    input.id = 'aria-input';
    input.type = 'text';
    input.setAttribute('placeholder', 'Ask Aria anything...');
    input.setAttribute('aria-label', 'Message to Aria');
    input.setAttribute('autocomplete', 'off');

    var sendBtn = document.createElement('button');
    sendBtn.id = 'aria-send-btn';
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(messagesArea);
    panel.appendChild(quickActions);
    panel.appendChild(inputArea);

    root.appendChild(fab);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Store references
    els.root = root;
    els.fab = fab;
    els.panel = panel;
    els.header = header;
    els.closeBtn = closeBtn;
    els.messages = messagesArea;
    els.quickActions = quickActions;
    els.inputArea = inputArea;
    els.input = input;
    els.sendBtn = sendBtn;
  }

  // ── Render Messages ──
  function renderMessages() {
    els.messages.innerHTML = '';
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i];
      appendMessageDOM(msg.sender, msg.text, msg.time, msg.html);
    }
    scrollToBottom();
  }

  function appendMessageDOM(sender, text, time, html) {
    var wrapper = document.createElement('div');
    wrapper.className = 'aria-msg aria-msg-' + sender;

    var bubble = document.createElement('div');
    bubble.className = 'aria-msg-bubble';
    if (html) {
      bubble.innerHTML = html;
    } else {
      bubble.textContent = text;
    }

    var ts = document.createElement('div');
    ts.className = 'aria-msg-time';
    ts.textContent = time || getTimestamp();

    wrapper.appendChild(bubble);
    wrapper.appendChild(ts);
    els.messages.appendChild(wrapper);
  }

  function addMessage(sender, text, html) {
    var msg = {
      sender: sender,
      text: text || '',
      html: html || '',
      time: getTimestamp()
    };
    messages.push(msg);
    saveHistory();
    appendMessageDOM(msg.sender, msg.text, msg.time, msg.html);
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(function() {
      els.messages.scrollTop = els.messages.scrollHeight;
    }, 50);
  }

  // ── Typing Indicator ──
  function showTyping() {
    if (isTyping) return;
    isTyping = true;
    var typing = document.createElement('div');
    typing.className = 'aria-typing';
    typing.id = 'aria-typing-indicator';
    typing.innerHTML = '<div class="aria-typing-dot"></div><div class="aria-typing-dot"></div><div class="aria-typing-dot"></div>';
    els.messages.appendChild(typing);
    scrollToBottom();
  }

  function hideTyping() {
    isTyping = false;
    var indicator = document.getElementById('aria-typing-indicator');
    if (indicator) indicator.parentNode.removeChild(indicator);
  }

  // ── Quick Actions Render ──
  function renderQuickActions() {
    var actions = getQuickActions();
    els.quickActions.innerHTML = '';
    for (var i = 0; i < actions.length; i++) {
      var chip = document.createElement('button');
      chip.className = 'aria-chip';
      chip.textContent = actions[i];
      chip.setAttribute('type', 'button');
      chip.setAttribute('tabindex', '0');
      (function(action) {
        chip.addEventListener('click', function() {
          handleUserInput(action);
        });
      })(actions[i]);
      els.quickActions.appendChild(chip);
    }
  }

  // ── Toggle Panel ──
  function togglePanel() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    isOpen = true;
    els.panel.setAttribute('aria-hidden', 'false');
    els.fab.setAttribute('aria-expanded', 'true');
    els.fab.setAttribute('aria-label', 'Close Aria assistant');
    els.fab.classList.add('aria-open');

    els.panel.classList.add('aria-visible');
    // Force reflow before adding shown class
    void els.panel.offsetHeight;
    setTimeout(function() {
      els.panel.classList.add('aria-shown');
    }, 10);

    renderQuickActions();

    // Welcome message on first open per session
    var welcomed = sessionStorage.getItem(WELCOME_SHOWN_KEY);
    if (!welcomed && messages.length === 0) {
      sessionStorage.setItem(WELCOME_SHOWN_KEY, '1');
      addMessage('aria', "Hi! I'm Aria, your CMG Builder Portal assistant. I can help you fill out your application, search for reference information, explain requirements, or schedule a consultation with your lending team. What can I help you with?");
    }

    // Focus management
    previousFocusEl = document.activeElement;
    setTimeout(function() {
      els.input.focus();
    }, 260);
  }

  function closePanel() {
    isOpen = false;
    els.panel.setAttribute('aria-hidden', 'true');
    els.fab.setAttribute('aria-expanded', 'false');
    els.fab.setAttribute('aria-label', 'Open Aria assistant');
    els.fab.classList.remove('aria-open');

    els.panel.classList.remove('aria-shown');
    setTimeout(function() {
      els.panel.classList.remove('aria-visible');
    }, 250);

    // Return focus
    if (previousFocusEl) {
      previousFocusEl.focus();
      previousFocusEl = null;
    } else {
      els.fab.focus();
    }
  }

  // ── Focus Trap ──
  function trapFocus(e) {
    if (!isOpen) return;
    if (e.key !== 'Tab') return;

    var focusable = els.panel.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ── Handle Search Flow ──
  function handleSearchFlow(query) {
    var searchType = detectSearchType();
    var cleanQuery = extractSearchQuery(query);

    addMessage('aria', 'Searching for "' + cleanQuery + '"...');
    showTyping();

    searchAPI(cleanQuery, searchType, function(err, resp) {
      hideTyping();

      if (!err && resp && resp.results && resp.results.length > 0) {
        // Show results from API
        for (var i = 0; i < resp.results.length; i++) {
          var r = resp.results[i];
          var cardHtml = buildSearchResultCard(r, searchType);
          addMessage('aria', '', cardHtml);
        }
      } else {
        // Fallback: google search
        var googleUrl = 'https://www.google.com/search?' + encodeQueryString({ q: cleanQuery });
        var fallbackHtml = '<div style="font-size:13px;line-height:1.55;">' +
          'I was not able to find that in our database. ' +
          'You can try a web search using the link below.<br><br>' +
          '<a href="' + escapeHTML(googleUrl) + '" target="_blank" rel="noopener noreferrer" ' +
          'style="color:#1F3D2E;font-weight:500;text-decoration:underline;">' +
          'Search for "' + escapeHTML(cleanQuery) + '"' +
          '</a></div>';
        addMessage('aria', '', fallbackHtml);
      }
    });
  }

  function encodeQueryString(params) {
    var parts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    return parts.join('&');
  }

  function buildSearchResultCard(result, type) {
    var lines = [];
    if (result.name) lines.push('<strong>' + escapeHTML(result.name) + '</strong>');
    if (result.phone) lines.push('Phone: ' + escapeHTML(result.phone));
    if (result.email) lines.push('Email: ' + escapeHTML(result.email));
    if (result.address) lines.push('Address: ' + escapeHTML(result.address));
    if (result.contact) lines.push('Contact: ' + escapeHTML(result.contact));
    if (result.trade) lines.push('Trade: ' + escapeHTML(result.trade));
    if (result.material) lines.push('Material: ' + escapeHTML(result.material));

    var cardId = 'aria-result-' + generateUUID().substring(0, 8);

    var html = '<div class="aria-search-result">' +
      '<div class="aria-search-result-name">' + escapeHTML(result.name || 'Result') + '</div>' +
      '<div class="aria-search-result-detail">' + lines.join('<br>') + '</div>' +
      '<button class="aria-autofill-btn" id="' + cardId + '" type="button">Auto-fill</button>' +
      '</div>';

    // Defer click binding
    setTimeout(function() {
      var btn = document.getElementById(cardId);
      if (btn) {
        btn.addEventListener('click', function() {
          var filled = autoFillFields(type, result);
          if (filled) {
            btn.textContent = 'Filled!';
            btn.disabled = true;
            btn.style.background = '#4ADE80';
            addMessage('aria', 'Done! I have filled in the form fields with the information I found. Please review and adjust as needed.');
          } else {
            btn.textContent = 'Not on matching step';
            btn.disabled = true;
            btn.style.background = 'var(--aw-text-muted)';
          }
        });
      }
    }, 100);

    return html;
  }

  // ── Handle User Input ──
  function handleUserInput(text) {
    if (!text || !text.trim()) return;
    text = text.trim();

    addMessage('user', text);
    els.input.value = '';

    // Check if search request
    if (isSearchRequest(text)) {
      handleSearchFlow(text);
      return;
    }

    showTyping();

    // Try API first, fall back to local
    sendToAPI(text, function(err, resp) {
      hideTyping();

      if (!err && resp && resp.reply) {
        addMessage('aria', resp.reply);

        // Handle actions from API
        if (resp.actions && resp.actions.length > 0) {
          for (var i = 0; i < resp.actions.length; i++) {
            handleAction(resp.actions[i]);
          }
        }
      } else {
        // Client-side fallback
        var localReply = findBestResponse(text);
        addMessage('aria', localReply);
      }
    });
  }

  function handleAction(action) {
    if (!action || !action.type) return;

    if (action.type === 'schedule') {
      var btn = document.getElementById('openScheduleModal');
      if (btn) btn.click();
    }

    if (action.type === 'navigate' && action.data && action.data.url) {
      var navUrl = action.data.url;
      if (navUrl.indexOf('http') === 0 && navUrl.indexOf(window.location.origin) !== 0) return;
      window.location.href = navUrl;
    }

    if (action.type === 'autofill' && action.data) {
      var type = action.data.type || detectSearchType();
      autoFillFields(type, action.data.fields || action.data);
    }

    if (action.type === 'search' && action.data && action.data.query) {
      handleSearchFlow(action.data.query);
    }
  }

  // ── Event Binding ──
  function bindEvents() {
    // FAB click
    els.fab.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    // Close button
    els.closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      closePanel();
    });

    // Send button
    els.sendBtn.addEventListener('click', function(e) {
      e.preventDefault();
      handleUserInput(els.input.value);
    });

    // Enter key
    els.input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        handleUserInput(els.input.value);
      }
    });

    // Escape key
    document.addEventListener('keydown', function(e) {
      if ((e.key === 'Escape' || e.keyCode === 27) && isOpen) {
        closePanel();
      }
    });

    // Focus trap
    els.panel.addEventListener('keydown', trapFocus);

    // Update quick actions when application step changes
    var stepObserver = null;
    if (typeof MutationObserver !== 'undefined') {
      var stepEl = document.getElementById('stepLabel');
      if (stepEl) {
        stepObserver = new MutationObserver(function() {
          if (isOpen) renderQuickActions();
        });
        stepObserver.observe(stepEl, { childList: true, characterData: true, subtree: true });
      }
    }
  }

  // ── Initialize ──
  function init() {
    sessionId = getSessionId();
    loadHistory();
    injectStyles();
    buildWidget();
    bindEvents();

    // Render any existing messages from history
    if (messages.length > 0) {
      renderMessages();
    }
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
