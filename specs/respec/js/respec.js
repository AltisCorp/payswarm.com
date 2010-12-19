
// ------------------------------------------------------------------------------------------ //
//  ReSpec.js -- a specification-writing tool
//  Robin Berjon, http://berjon.com/
//  ----------------------------------------------------------------------------------------- //
//  Documentation: http://dev.w3.org/2009/dap/ReSpec.js/documentation.html
//  License: http://www.w3.org/Consortium/Legal/2002/copyright-software-20021231
// ------------------------------------------------------------------------------------------ //

// XXX TODO
//  - move to the top of dev. hierarchy
//  - add autolinking to headers in the output (like WebIDL)
//  - better inline dependent CSS
//  - add typographical conventions section
//  - WebIDL
//      . make it so that extended attributes on members and attributes are only wrapped if needed
//      . make processor aware of some extended attributes (e.g. Constructor)
//      . support variadic params
//      . support arrays
//      . support special operations: getter, setter, creator, deleter, caller, omittable
//      . support stringifiers
//  - add support for a test variant of the specification, based on the ideas in P+C
//  - some refactoring is in order
//  - make a widget that can save using the FS API, and inject the API without it being in the template,
//    inline CSS without hassle, etc.
//  - make a list of links to issues appear on a key combination
//  - warn on empty links to no dfn (perhaps in a special debug mode?)
//  - make everything that uses "::before" actually generate the real content instead

(function () {
if (typeof(berjon) == "undefined") berjon = {};
var sn;
function _errEl () {
    var err = document.getElementById("respec-err");
    if (err) return err.firstElementChild;
    err = sn.element("div", 
                        { id: "respec-err", 
                          style: "position: fixed; width: 350px; top: 10px; right: 10px; border: 3px double #f00; background: #fff",
                          "class": "removeOnSave" },
                        document.body);
    return sn.element("ul", {}, err);
}
function error (str) {
    sn.element("li", { style: "color: #c00" }, _errEl(), str);
}
function warning (str) {
    sn.element("li", { style: "color: #666" }, _errEl(), str);
}
berjon.respec = function () {
    for (var k in this.status2text) {
        if (this.status2long[k]) continue;
        this.status2long[k] = this.status2text[k];
    }
};
berjon.respec.prototype = {
    title:          null,
    additionalCopyrightHolders: null,
    editors:        [],
    authors:        [],

    recTrackStatus: ["FPWD", "WD", "LC", "CR", "PR", "PER", "REC"],
    noTrackStatus:  ["MO", "unofficial", "base"],
    status2text:    {
        NOTE:           "Note",
        "WG-NOTE":      "Working Group Note",
        "CG-NOTE":      "Co-ordination Group Note",
        "IG-NOTE":      "Interest Group Note",
        "Member-SUBM":  "Member Submission",
        "Team-SUBM":    "Team Submission",
        XGR:            "Incubator Group Report",
        MO:             "Member-Only Document",
        ED:             "Editor's Draft",
        FPWD:           "Working Draft",
        WD:             "Working Draft",
        LC:             "Working Draft",
        CR:             "Candidate Recommendation",
        PR:             "Proposed Recommendation",
        PER:            "Proposed Edited Recommendation",
        REC:            "Recommendation",
        RSCND:          "Rescinded Recommendation",
        unofficial:     "Unofficial Draft",
        base:           "Document",
    },
    status2long:    {
        FPWD:           "First Public Working Draft",
        LC:             "Last Call Working Draft",
    },
    status2maturity:    {
        FPWD:       "WD",
        LC:         "WD",
        "WG-NOTE":  "NOTE",
    },
    
    isLocal:    false,
    loadAndRun:    function () {
        var scripts = document.querySelectorAll("script[src]");
        var rs, base;
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src;
            if (/\/js\/respec\.js$/.test(src)) {
                rs = scripts[i];
                base = src.replace(/js\/respec\.js$/, "");
            }
        }
        this.base = base;
        if (base.indexOf("file://") == 0) this.isLocal = true;
        
        var loaded = [];
        var deps = ["js/simple-node.js", "js/shortcut.js", "bibref/biblio.js", "js/sh_main.min.js"];
        var head = document.getElementsByTagName('head')[0];
        var obj = this;
        for (var i = 0; i < deps.length; i++) {
            var dep = deps[i];
            var sel = document.createElement('script');
            sel.type = 'text/javascript';
            sel.src = base + dep;
            sel.setAttribute("class", "remove");
            sel.onload = function (ev) {
                loaded.push(ev.target.src);
                if (obj.isLocal && ev.target.src.indexOf("sh_main") > 0) {
                    // dirty hack to fix local loading of SHJS
                    this.oldSHLoad = window.sh_load;
                    window.sh_load = function (language, element, prefix, suffix) {
                        if (language in sh_requests) {
                            sh_requests[language].push(element);
                            return;
                        }
                        sh_requests[language] = [element];
                        var url = prefix + 'sh_' + language + suffix;
                        var shLang = document.createElement('script');
                        shLang.type = 'text/javascript';
                        shLang.src = url;
                        shLang.setAttribute("class", "remove");
                        shLang.onload = function (ev) {
                            var elements = sh_requests[language];
                            for (var i = 0; i < elements.length; i++) {
                                sh_highlightElement(elements[i], sh_languages[language]);
                            }
                        };
                        head.appendChild(shLang);
                    };
                }
                if (loaded.length == deps.length) {
                    sn = new berjon.simpleNode({
                        "":     "http://www.w3.org/1999/xhtml",
                        "x":    "http://www.w3.org/1999/xhtml"
                    }, document);
                    obj.run();
                }
            };
            head.appendChild(sel);
        }
    },
    
    run:    function () {
        document.body.style.display = "none";
        try {
            this.extractConfig();
            if (respecConfig.preProcess) {
                for (var i = 0; i < respecConfig.preProcess.length; i++) respecConfig.preProcess[i].apply(this);
            }
            this.makeTemplate();

            this.dfn();
            this.inlines();

            this.webIDL();
            this.examples();

            this.informative();
            this.fixHeaders();
            this.makeTOC();
            this.idHeaders();

            if (respecConfig.postProcess) {
                for (var i = 0; i < respecConfig.postProcess.length; i++) respecConfig.postProcess[i].apply(this);
            }

            // if (this.doMicroData) this.makeMicroData();
            // if (this.doRDFa) this.makeRDFa();
            this.unHTML5();
            this.removeRespec();

            // shortcuts
            var obj = this;
            // shortcut.add("Alt+H", function () { obj.toHTML(); });
            // shortcut.add("Shift+Alt+H", function () { obj.toHTMLSource(); });
            shortcut.add("Ctrl+Shift+Alt+S", function () { obj.showSaveOptions(); });
            shortcut.add("Esc", function () { obj.hideSaveOptions(); });
        }
        catch (e) {
            document.body.style.display = "inherit";
            error(e);
        }
        document.body.style.display = "inherit";
    },
    
    saveMenu: null,
    showSaveOptions:    function () {
        var obj = this;
        this.saveMenu = sn.element("div",
                        { style: "position: fixed; width: 400px; top: 10px; padding: 1em; border: 5px solid #90b8de; background: #fff" },
                        document.body);
        sn.element("h4", {}, this.saveMenu, "Save Options");
        var butH = sn.element("button", {}, this.saveMenu, "Save as HTML");
        butH.onclick = function () { obj.hideSaveOptions(); obj.toHTML(); };
        var butS = sn.element("button", {}, this.saveMenu, "Save as HTML (Source)");
        butS.onclick = function () { obj.hideSaveOptions(); obj.toHTMLSource(); };
    },
    
    hideSaveOptions:    function () {
        if (!this.saveMenu) return;
        this.saveMenu.parentNode.removeChild(this.saveMenu);
    },

    toString:    function () {
        var str = "<!DOCTYPE html";
        var dt = document.doctype;
        if (dt && dt.publicId) {
            str += " PUBLIC '" + dt.publicId + "' '" + dt.systemId + "'";
        }
        else { // when HTML5 is allowed we can remove this
            str += " PUBLIC '-//W3C//DTD HTML 4.01 Transitional//EN' 'http://www.w3.org/TR/html4/loose.dtd'";
        }
        str += ">\n";
        str += "<html";
        var ats = document.documentElement.attributes;
        for (var i = 0; i < ats.length; i++) {
            str += " " + ats[i].name + "=\"" + this._esc(ats[i].value) + "\"";
        }
        str += ">\n";
        str += document.documentElement.innerHTML;
        str += "</html>";
        return str;
    },
    
    toHTML:    function () {
        var x = window.open();
        x.document.write(this.toString());
        x.document.close();
    },
    
    toHTMLSource:    function () {
        var x = window.open();
        x.document.write("<pre>" + this._esc(this.toString()) + "</pre>");
        x.document.close();
    },
    
    // --- METADATA -------------------------------------------------------
    extractConfig:    function () {
        this.title = document.title;
        var cfg;
        if (respecConfig) cfg = respecConfig;
        else              cfg = {};
        // defaulting
        if (!cfg.specStatus) cfg.specStatus = "ED";
        if (!cfg.publishDate) cfg.publishDate = new Date();
        else cfg.publishDate = this._parseDate(cfg.publishDate);
        if (cfg.previousPublishDate) cfg.previousPublishDate = this._parseDate(cfg.previousPublishDate);
        if (cfg.previousPublishDate && ! cfg.previousMaturity) error("Previous date is set, but not previousMaturity");
        if (cfg.lcEnd) cfg.lcEnd = this._parseDate(cfg.lcEnd);
        if (cfg.specStatus == "LC" && !cfg.lcEnd) error("If specStatus is set to LC, then lcEnd must be defined");
        if (!cfg.editors) cfg.editors = [];
        if (!cfg.authors) cfg.authors = [];
        if (!cfg.inlineCSS) cfg.inlineCSS = true;
        if (!cfg.noIDLSorting) cfg.noIDLSorting = false;
        if (!cfg.noIDLIn) cfg.noIDLIn = false;
        if (!cfg.maxTocLevel) cfg.maxTocLevel = 0;
        for (var k in cfg) this[k] = cfg[k];
        this.isRecTrack = this.recTrackStatus.indexOf(this.specStatus) >= 0;
        this.isNoTrack = this.noTrackStatus.indexOf(this.specStatus) >= 0;
        // this.specStatus = this._getMetaFor("http://berjon.com/prop/spec-status", "ED");
        // this.shortName = this._getMetaFor("http://berjon.com/prop/short-name", "xxx-xxx");
        // this.publishDate = this._getDateFor("head > time[itemprop='http://berjon.com/prop/publish-date']");
        // this.prevPublishDate = this._getDateFor("head > time[itemprop='http://berjon.com/prop/previous-publish-date']");
    },
    
    _getMetaFor:    function (iProp, def) {
        var meta = document.querySelector("head > meta[itemprop='" + iProp + "']");
        if (meta) return meta.getAttribute("content");
        else      return def;
    },

    _getDateFor:    function (sel) {
        var el = document.querySelector(sel);
        if (el) {
            var val = el.getAttribute('datetime');
            return new Date(val.substr(0, 4), val.substr(5, 2), val.substr(8, 2));
        }
        else {
            return new Date();
        }
    },
    
    // --- W3C BASICS -----------------------------------------------------------------------------------------
    makeTemplate:   function () {
        this.rootAttr();
        this.addCSS();
        this.makeHeaders();
        this.makeAbstract();
        this.makeSotD();
        this.makeConformance();
    },
    
    rootAttr:   function () {
        document.documentElement.setAttribute("lang", "en");
        document.documentElement.setAttribute("dir", "ltr");
    },
    
    addCSS: function () {
        if (this.extraCSS) {
            for (var i = 0; i < this.extraCSS.length; i++) this._insertCSS(this.extraCSS[i], this.inlineCSS);
        }
        var statStyle = this.specStatus;
        if (statStyle == "FPWD" || statStyle == "LC") statStyle = "WD";
        var css;
        if (statStyle == "unofficial") {
            css = "http://www.w3.org/StyleSheets/TR/w3c-unofficial";
        }
        else if (statStyle == "base") {
            css = "http://www.w3.org/StyleSheets/TR/base";
        }
        else {
            css = "http://www.w3.org/StyleSheets/TR/W3C-" + statStyle;// + ".css";
        }
        this._insertCSS(css, false);
    },
    
    // single function used to display people information for editors,
    // authors, etc (fjh 2009-12-04)

    showPeople: function(name, people) {
        var header = "";

        if (people.length == 0) return header;

        if (people.length > 1) {
            header += "<dt>" + name + "s:</dt>";
        } else {
            header += "<dt>" + name + ":</dt>";
        }

        for (var i = 0; i < people.length; i++) {
            var pers = people[i];
            header += "<dd>";
            if (pers.url) {
                header += "<a href='" + pers.url + "'>" + pers.name + "</a>";
            } else {
                header += pers.name;
            }
            if (pers.company) {
                header += ", ";
                if (pers.companyURL) {
                    header += "<a href='" + pers.companyURL + "'>" +
            pers.company + "</a>";
                } else {
                    header += pers.company;
                }
            }
            if (pers.mailto) {
                header += " <a href='mailto:" + pers.mailto + "'>" + pers.mailto + "</a> ";
            }
            if (pers.note) {
                header += " ( " + pers.note + " )";
            }
            header += "</dd>";
        }
        return header;
    },

    makeHeaders:    function () {
        var mat = (this.status2maturity[this.specStatus]) ? this.status2maturity[this.specStatus] : this.specStatus;
        var thisVersion = "http://www.w3.org/TR/" + this.publishDate.getFullYear() + "/" + mat + "-" +
                          this.shortName + "-" + this._concatDate(this.publishDate) + "/";
        if (this.specStatus == "ED") thisVersion = this.edDraftURI;
        var latestVersion, prevVersion;
        if (this.previousPublishDate) {
            var pmat = (this.status2maturity[this.previousMaturity]) ? this.status2maturity[this.previousMaturity] : this.previousMaturity;
            var prevURI = "http://www.w3.org/TR/" + this.previousPublishDate.getFullYear() + "/" + pmat + "-" +
                          this.shortName + "-" + this._concatDate(this.previousPublishDate) + "/";
            prevVersion = "<a href='" + prevURI + "'>" + prevURI + "</a>";
            // var latestURI = "http://www.w3.org/TR/" + this.shortName + "/";
            // latestVersion = "<a href='" + latestURI + "'>" + latestURI + "</a>";
        }
        else {
            prevVersion = "none";
            // latestVersion = "none";
        }
        var latestURI = "http://www.w3.org/TR/" + this.shortName + "/";
        latestVersion = "<a href='" + latestURI + "'>" + latestURI + "</a>";
        var header = 
            "<div class='head'>" + 
            "<p><a href='http://www.w3.org/'><img width='72' height='48' src='http://www.w3.org/Icons/w3c_home' alt='W3C'/></a>" +
            "<h1>" + this.title + "</h1>" +
            "<h2>W3C " + this.status2text[this.specStatus] + " " + this._humanDate(this.publishDate) + "</h2><dl>";
        if (!this.isNoTrack)
            header += "<dt>This Version:</dt><dd><a href='" + thisVersion + "'>" + thisVersion + "</a></dd>" + 
                      "<dt>Latest Published Version:</dt><dd>" + latestVersion + "</dd>" + 
                      "<dt>Latest Editor's Draft:</dt><dd><a href='" + this.edDraftURI + "'>" + this.edDraftURI + "</a></dd>";
        if (this.specStatus != "FPWD" && !this.isNoTrack)
            header += "<dt>Previous version:</dt><dd>" + prevVersion + "</dd>";

        if (this.prevRecShortname) {
            var prevRecURI = "http://www.w3.org/TR/" + this.prevRecShortname + "/";
            header += "<dt>Latest Recommendation:</dt><dd>" + 
                '<a href="' + prevRecURI + '">' + prevRecURI + "</a></dd>";
        }

        if(this.editors.length == 0) {
            header += "<dt>" + "Editor" + ":</dt>";
            error("There must be at least one editor.");
        }
        header += this.showPeople("Editor", this.editors);
        header += this.showPeople("Author", this.authors);

        header += 
            "</dl><p class='copyright'><a href='http://www.w3.org/Consortium/Legal/ipr-notice#Copyright'>Copyright</a> © " + 
            this.publishDate.getFullYear();
        if (this.additionalCopyrightHolders) {
            header += " " + this.additionalCopyrightHolders + " &amp;";
        }
        header += " <a href='http://www.w3.org/'><acronym title='World Wide Web Consortium'>W3C</acronym></a><sup>®</sup> " + 
            "(<a href='http://www.csail.mit.edu/'><acronym title='Massachusetts Institute of Technology'>MIT</acronym></a>, " +
            "<a href='http://www.ercim.eu/'><acronym title='European Research Consortium for Informatics and Mathematics'>ERCIM</acronym></a>, " +
            "<a href='http://www.keio.ac.jp/'>Keio</a>), All Rights Reserved. " +
            "W3C <a href='http://www.w3.org/Consortium/Legal/ipr-notice#Legal_Disclaimer'>liability</a>, " + 
            "<a href='http://www.w3.org/Consortium/Legal/ipr-notice#W3C_Trademarks'>trademark</a> and " +
            "<a href='http://www.w3.org/Consortium/Legal/copyright-documents'>document use</a> rules apply.</p><hr/></div>";
        
        var tmp = sn.element("div");
        tmp.innerHTML = header;
        document.body.insertBefore(tmp.firstChild, document.body.firstChild);
    },
    
    makeAbstract:    function () {
        var abs = document.getElementById("abstract");
        if (!abs) error("Document must have one element with ID 'abstract'");
        // var div = sn.renameEl(abs, "div");
        // div.setAttribute("class", "section");
        var h2 = sn.element("h2", {}, null, "Abstract");
        abs.insertBefore(h2, abs.firstChild);
        // abs.setAttribute("class", "introductory");
        sn.addClass(abs, "introductory");
    },
    
    makeSotD:     function () {
        var sotd;
        if (this.isNoTrack) {
            var mc = (this.specStatus == "MO") ? " member-confidential" : "";
            sotd = "<section id='sotd' class='introductory'><h2>Status of This Document</h2>" +
                "<p>This document is merely a W3C-internal" + mc + " document. It has no "+
                "official standing of any kind and does not represent consensus of the W3C Membership.</p></section>";
        }
        else {
            var art = "a ";
            var custom = document.getElementById("sotd");
            if (this.specStatus == "ED" || this.specStatus == "XGR" || this.specStatus == "IG-NOTE") art = "an ";
            sotd = "<section id='sotd' class='introductory'><h2>Status of This Document</h2>" +
                "<p><em>This section describes the status of this document at the time of its publication. Other " +
                "documents may supersede this document. A list of current W3C publications and the latest revision " +
                "of this technical report can be found in the <a href='http://www.w3.org/TR/'>W3C technical reports " +
                "index</a> at http://www.w3.org/TR/.</em></p>";
            if (custom) {
                sotd += custom.innerHTML;
                custom.parentNode.removeChild(custom);
            }
            sotd +=
                "<p>This document was published by the <a href='" + this.wgURI + "'>" + this.wg + "</a> as " + art + this.status2long[this.specStatus] + ".";
            if (this.isRecTrack && this.specStatus != "REC") sotd += " This document is intended to become a W3C Recommendation.";
            sotd +=
                " If you wish to make comments regarding this document, please send them to <a href='mailto:" + this.wgPublicList + "@w3.org'>" + 
                this.wgPublicList + "@w3.org</a> (<a href='mailto:" + this.wgPublicList + "-request@w3.org?subject=subscribe'>subscribe</a>, " +
                "<a href='http://lists.w3.org/Archives/Public/" + this.wgPublicList + "/'>archives</a>).";
            if (this.specStatus == "LC") sotd += " The Last Call period ends " + this._humanDate(this.lcEnd) + ".";
            sotd += " All feedback is welcome.</p>";
            if (this.specStatus != "REC") {
                sotd += "<p>Publication as a " + this.status2text[this.specStatus] + " does not imply endorsement by the W3C Membership. " +
                    "This is a draft document and may be updated, replaced or obsoleted by other documents at any time. It is inappropriate " +
                    "to cite this document as other than work in progress.</p>";
            }
            if (this.specStatus == "LC") 
                sotd += "<p>This is a Last Call Working Draft and thus the Working Group has determined that this document has satisfied the " +
                        "relevant technical requirements and is sufficiently stable to advance through the Technical Recommendation process.</p>";
            sotd +=
                "<p>This document was produced by a group operating under the <a href='http://www.w3.org/Consortium/Patent-Policy-20040205/'>5 February " +
                "2004 W3C Patent Policy</a>. W3C maintains a <a href='" + this.wgPatentURI + "' rel='disclosure'>public list of any patent disclosures</a> " +
                "made in connection with the deliverables of the group; that page also includes instructions for disclosing a patent. An " +
                "individual who has actual knowledge of a patent which the individual believes contains " +
                "<a href='http://www.w3.org/Consortium/Patent-Policy-20040205/#def-essential'>Essential Claim(s)</a> must disclose the " +
                "information in accordance with <a href='http://www.w3.org/Consortium/Patent-Policy-20040205/#sec-Disclosure'>section " +
                "6 of the W3C Patent Policy</a>.</p></section>";
        }

        var tmp = sn.element("div");
        tmp.innerHTML = sotd;
        var abs = document.getElementById("abstract");
        abs.parentNode.insertBefore(tmp.firstChild, abs.nextSibling);
    },

    makeConformance:    function () {
        var confo = document.getElementById("conformance");
        if (!confo) return;
        var dummy = sn.element("div");
        if (confo.childNodes.length > 0) sn.copyChildren(confo, dummy);
        sn.element("h2", {}, confo, "Conformance");
        confo.innerHTML += "<p>As well as sections marked as non-normative, all authoring guidelines, diagrams, examples, " +
                           "and notes in this specification are non-normative. Everything else in this specification is " +
                           "normative.</p>\n<p>The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY, " +
                           "and OPTIONAL in this specification are to be interpreted as described in [[!RFC2119]].</p>\n";
        sn.copyChildren(dummy, confo);
    },

    informative:    function () {
        var secs = document.querySelectorAll("section.informative");
        for (var i = 0; i < secs.length; i++) {
            var sec = secs[i];
            var p = sn.element("p");
            sn.element("em", {}, p, "This section is non-normative.");
            sec.insertBefore(p, sec.firstElementChild.nextSibling);
        }
    },

    examples:    function () {
        // reindent
        var exes = document.querySelectorAll("pre.example");
        for (var i = 0; i < exes.length; i++) {
            var ex = exes[i];
            var lines = ex.textContent.split("\n");
            while (lines.length && /^\s*$/.test(lines[0])) lines.shift();
            while (/^\s*$/.test(lines[lines.length - 1])) lines.pop();
            var matches = /^(\s+)/.exec(lines[0]);
            if (matches) {
                var rep = new RegExp("^" + matches[1]);
                for (var j = 0; j < lines.length; j++) {
                    lines[j] = lines[j].replace(rep, "");
                }
            }
            ex.textContent = lines.join("\n");
        }
        // highlight
        sh_highlightDocument(this.base + "js/lang/", ".min.js");
    },

    fixHeaders:    function () {
        var secs = document.querySelectorAll("section > h1:first-child, section > h2:first-child, section > h3:first-child, section > h4:first-child, section > h5:first-child, section > h6:first-child");
        for (var i = 0; i < secs.length; i++) {
            var sec = secs[i];
            var depth = sn.findNodes("ancestor::x:section|ancestor::section", sec).length + 1;
            if (depth > 6) depth = 6;
            var h = "h" + depth;
            if (sec.localName.toLowerCase() != h) sn.renameEl(sec, h);
        }
    },
    
    makeTOC:    function () {
        var ul = this.makeTOCAtLevel(document.body, [0], 1);
        if (!ul) return;
        var sec = sn.element("section", { id: "toc" });
        sn.element("h2", { "class": "introductory" }, sec, "Table of Contents");
        sec.appendChild(ul);
        document.body.insertBefore(sec, document.getElementById("sotd").nextSibling);
    },
    
    appendixMode:   false,
    lastNonAppendix:    0,
    alphabet:   "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    makeTOCAtLevel:    function (parent, current, level) {
        var secs = sn.findNodes("./x:section[not(@class='introductory')]|./section[not(@class='introductory')]", parent);
        if (secs.length == 0) return null;
        var ul = sn.element("ul", { "class": "toc" });
        for (var i = 0; i < secs.length; i++) {
            var sec = secs[i];
            if (!sec.childNodes.length) continue;
            var h = sec.firstElementChild;
            var ln = h.localName.toLowerCase();
            if (ln != "h2" && ln != "h3" && ln != "h4" && ln != "h5" && ln != "h6") continue;
            var title = h.textContent;
            var hKids = sn.documentFragment();
            for (var j = 0; j < h.childNodes.length; j++) {
                var node = h.childNodes[j].cloneNode(true);
                hKids.appendChild(node);
                if (node.nodeType == Node.ELEMENT_NODE) {
                    var ln = node.localName.toLowerCase();
                    if (ln == "a") {
                        node = sn.renameEl(node, "span");
                        var cl = node.getAttribute("class");
                        if (!cl) cl = "";
                        else cl = " " + cl;
                        // node.setAttribute("class", "formerLink" + cl);
                        sn.addClass(node, "formerLink" + cl);
                        node.removeAttribute("href");
                    }
                    else if (ln == "dfn") {
                        node = sn.renameEl(node, "span");
                        node.removeAttribute("id");
                    }
                }
            }
            var id = sn.makeID(sec, null, title);
            current[current.length-1]++;
            var secnos = current.slice();
            // if (sec.getAttribute("class") == "appendix" && current.length == 1 && !this.appendixMode) {
            if (sn.hasClass(sec, "appendix") && current.length == 1 && !this.appendixMode) {
                this.lastNonAppendix = current[0];
                this.appendixMode = true;
            }
            if (this.appendixMode) secnos[0] = this.alphabet.charAt(current[0] - this.lastNonAppendix);
            var secno = secnos.join(".");
            if (!/\./.test(secno)) secno = secno + ".";
            var df = sn.documentFragment();
            sn.element("span", { "class": "secno" }, df, secno + " ");
            // sn.text(" ", df);
            var df2 = df.cloneNode(true);
            h.insertBefore(df, h.firstChild);
            // sn.text(title, df2);
            df2.appendChild(hKids);
            var a = sn.element("a", { href: "#" + id }, null, [df2]);
            sn.element("li", {}, ul, [a]);
            
            if (this.maxTocLevel && level >= this.maxTocLevel) continue;
            current.push(0);
            var sub = this.makeTOCAtLevel(sec, current, level + 1);
            if (sub) sn.element("li", {}, ul, [sub]);
            current.pop();
        }
        
        return ul;
    },

    idHeaders:    function () {
        var heads = document.querySelectorAll("h2, h3, h4, h5, h6");
        for (var i = 0; i < heads.length; i++) {
            var h = heads[i];
            if (h.hasAttribute("id")) continue;
            var par = h.parentNode;
            if (par.localName.toLowerCase() == "div" && par.hasAttribute("id") && !h.previousElementSibling) continue;
            sn.makeID(h, null);
        }
    },
    
    // --- INLINE PROCESSING ----------------------------------------------------------------------------------
    inlines:    function () {
        document.normalize();
        
        // PRE-PROCESSING
        var norms = {}, informs = {}, abbrMap = {}, acroMap = {}, badrefs = {};
        var badrefcount = 0;
        var abbrs = document.querySelectorAll("abbr[title]");
        for (var i = 0; i < abbrs.length; i++) abbrMap[abbrs[i].textContent] = abbrs[i].getAttribute("title");
        var acros = document.querySelectorAll("acronym[title]");
        for (var i = 0; i < acros.length; i++) acroMap[acros[i].textContent] = acros[i].getAttribute("title");
        var aKeys = [];
        for (var k in abbrMap) aKeys.push(k);
        for (var k in acroMap) aKeys.push(k);
        aKeys.sort(function (a, b) {
            if (b.length < a.length) return -1;
            if (a.length < b.length) return 1;
            return 0;
        });
        var abbrRx = "(?:\\b" + aKeys.join("\\b)|(?:\\b") + "\\b)";
                
        // PROCESSING
        var txts = sn.findNodes(".//text()", document.body);
        for (var i = 0; i < txts.length; i++) {
            var txt = txts[i];
            var rx = new RegExp("(\\bMUST(?:\\s+NOT)?\\b|\\bSHOULD(?:\\s+NOT)?\\b|\\bSHALL(?:\\s+NOT)?\\b|" + 
                                "\\bMAY\\b|\\b(?:NOT\\s+)?REQUIRED\\b|\\b(?:NOT\\s+)?RECOMMENDED\\b|\\bOPTIONAL\\b|" +
                                "(?:\\[\\[(?:!)?[A-Za-z0-9-]+\\]\\])|" +
                                abbrRx + ")");
            var subtxt = txt.data.split(rx);
            var df = sn.documentFragment();
            while (subtxt.length) {
                var t = subtxt.shift();
                var matched = null;
                if (subtxt.length) matched = subtxt.shift();
                sn.text(t, df);
                if (matched) {
                    // RFC 2129
                    if (/MUST(?:\s+NOT)?|SHOULD(?:\s+NOT)?|SHALL(?:\s+NOT)?|MAY|(?:NOT\s+)?REQUIRED|(?:NOT\s+)?RECOMMENDED|OPTIONAL/.test(matched)) {
                        matched = matched.toLowerCase();
                        sn.element("em", { "class": "rfc2119", title: matched }, df, matched);
                    }
                    // BIBREF
                    else if (/^\[\[/.test(matched)) {
                        var ref = matched;
                        ref = ref.replace(/^\[\[/, "");
                        ref = ref.replace(/]]$/, "");
                        var norm = false;
                        if (ref.indexOf("!") == 0) {
                            norm = true;
                            ref = ref.replace(/^!/, "");
                        }
                        if (berjon.biblio[ref]) {
                            if (norm) norms[ref] = true;
                            else      informs[ref] = true;
                            sn.text("[", df);
                            sn.element("a", { "class": "bibref", rel: "biblioentry", href: "#bib-" + ref }, df, ref);
                            sn.text("]", df);
                        }
                        else {
                            badrefcount++;
                            if ( badrefs[ref] ) {
                                badrefs[ref] = badrefs[ref] + 1 ;
                            } else {
                                badrefs[ref] =  1 ;
                            }
                        }
                    }
                    // ABBR
                    else if (abbrMap[matched]) {
                        sn.element("abbr", { title: abbrMap[matched] }, df, matched);
                    }
                    // ACRO
                    else if (acroMap[matched]) {
                        sn.element("acronym", { title: acroMap[matched] }, df, matched);
                    }
                    // FAIL
                    else {
                        error("Found token '" + matched + "' but it does not correspond to anything");
                    }
                }
            }
            txt.parentNode.replaceChild(df, txt);
        }
        
        // POST-PROCESSING
        // bibref
    if(badrefcount > 0) {
        error("Got " + badrefcount + " tokens looking like a reference, not in biblio DB: ");
        for (var item in badrefs) {
            error("Bad ref" + item + ", count = " + badrefs[item]);
        }
    }

        var del = [];
        for (var k in informs) {
            if (norms[k]) del.push(k);
        }
        for (var i = 0; i < del.length; i++) delete informs[del[i]];

    var refsec = sn.element("section", { id: "references", "class": "appendix" }, document.body);
    sn.element("h2", {}, refsec, "References");
    if (this.refNote) { 
        var refnote = sn.element("p", {}, refsec);
        refnote.innerHTML= this.refNote;
    }
        var types = ["Normative", "Informative"];
        for (var i = 0; i < types.length; i++) {
            var type = types[i];
            var refMap = (type == "Normative") ? norms : informs;
            var sec = sn.element("section", {}, refsec);
            sn.makeID(sec, null, type + " references");
            sn.element("h3", {}, sec, type + " references");
            var refs = [];
            for (var k in refMap) refs.push(k);
            refs.sort();
            if (refs.length) {
                var dl = sn.element("dl", { "class": "bibliography" }, sec);
                for (var j = 0; j < refs.length; j++) {
                    var ref = refs[j];
                    sn.element("dt", { id: "bib-" + ref }, dl, "[" + ref + "]");
                    var dd = sn.element("dd", {}, dl);
                    if (berjon.biblio[ref]) dd.innerHTML = berjon.biblio[ref];
                }
            }
            else {
                sn.element("p", {}, sec, "No " + type.toLowerCase() + " references.");
            }
        }
        
    },
        
    dfn:    function () {
        document.normalize();
        var dfnMap = {};
        var dfns = document.querySelectorAll("dfn");
        for (var i = 0; i < dfns.length; i++) {
            var dfn = dfns[i];
            var title = this._getDfnTitle(dfn);
            dfnMap[title] = sn.makeID(dfn, "dfn", title);
        }
        
        var ants = document.querySelectorAll("a:not([href])");
        for (var i = 0; i < ants.length; i++) {
            var ant = ants[i];
            // if (ant.getAttribute("class") == "externalDFN") continue;
            if (sn.hasClass(ant, "externalDFN")) continue;
            var title = this._getDfnTitle(ant);
            if (dfnMap[title] && !(dfnMap[title] instanceof Function)) {
                ant.setAttribute("href", "#" + dfnMap[title]);
                // ant.setAttribute("class", "internalDFN");
                sn.addClass(ant, "internalDFN");
            }
            else {
                // we want to use these for other links too
                // error("No definition for title: " + title);
            }
        }
    },
    
    // --- WEB IDL --------------------------------------------------------------------------------------------
    webIDL:    function () {
        var idls = document.querySelectorAll(".idl"); // should probably check that it's not inside one
        var infNames = [];
        for (var i = 0; i < idls.length; i++) {
            var idl = idls[i];
            var w = new berjon.WebIDLProcessor({ noIDLSorting: this.noIDLSorting, noIDLIn: this.noIDLIn });
            var inf = w.definition(idl);
            var df = w.makeMarkup();
            idl.parentNode.replaceChild(df, idl);
            if (inf.type == "interface" || inf.type == "exception") infNames.push(inf.id);
        }
        document.normalize();
        var ants = document.querySelectorAll("a:not([href])");
        for (var i = 0; i < ants.length; i++) {
            var ant = ants[i];
            if (sn.hasClass(ant, "externalDFN")) continue;
            var name = ant.textContent;
            if (infNames.indexOf(name) >= 0) {
                ant.setAttribute("href", "#idl-def-" + name);
                // ant.setAttribute("class", "idlType");
                sn.addClass(ant, "idlType");
                ant.innerHTML = "<code>" + name + "</code>";
            }
        }
    },

    // --- CLEANUP --------------------------------------------------------------------------------------------
    removeRespec:    function () {
        var rs = document.querySelectorAll(".remove");
        for (var i = 0; i < rs.length; i++) rs[i].parentNode.removeChild(rs[i]);
    },
    
    unHTML5:    function () {
        var secs = document.querySelectorAll("section");
        for (var i = 0; i < secs.length; i++) {
            var sec = secs[i];
            var div = sn.renameEl(sec, "div");
            // div.setAttribute("class", "section"); // XXX that kills previous class, may not be a problem
            sn.addClass(div, "section");
        }
    },
    
    // --- HELPERS --------------------------------------------------------------------------------------------
    _insertCSS:    function (css, inlined) {
        // if (document.createStyleSheet) return document.createStyleSheet(css);
        if (inlined) {
            try {
                // this is synchronous because order of the CSS matters (if though PubRules doesn't detect this
                // correctly :-) If it's slow, turn off inlineCSS during development
                var xhr = new XMLHttpRequest();
                xhr.open("GET", css, false);
                // xhr.onreadystatechange = function () {
                //     if (this.readyState == 4) {
                //         if (this.status == 200) {
                //             sn.element("style", { type: "text/css" }, document.documentElement.firstElementChild, this.responseText);
                //         }
                //         else {
                //             error("There appear to have been a problem fetching the style sheet; status=" + this.status);
                //         }
                //     }
                // };
                xhr.send(null);
                if (xhr.status == 200) {
                    sn.element("style", { type: "text/css" }, document.documentElement.firstElementChild, xhr.responseText);
                }
                else {
                    error("There appear to have been a problem fetching the style sheet; status=" + xhr.status);
                }
            }
            catch (e) {
                // warning("There was an error with the request, probably that you're working from disk.");
                this._insertCSS(css, false);
            }
        }
        else {
            sn.element("link", {
                href:       css,
                rel:        "stylesheet",
                type:       "text/css",
                charset:    "utf-8"
            }, document.documentElement.firstElementChild);
        }
    },
    
    _humanMonths:   ["January", "February", "March", "April", "May", "June", "July",
                     "August", "September", "October", "November", "December"],
    _humanDate:    function (date) {
        return this._lead0(date.getDate()) + " " + this._humanMonths[date.getMonth()] + " " + date.getFullYear();
    },
    
    _concatDate:    function (date) {
        return "" + date.getFullYear() + this._lead0(date.getMonth() + 1) + this._lead0(date.getDate());
    },
    
    _parseDate:    function (str) {
        return new Date(str.substr(0, 4), (str.substr(5, 2) - 1), str.substr(8, 2));
    },
    
    _lead0:    function (str) {
        str = "" + str;
        return (str.length == 1) ? "0" + str : str;
    },
    
    _getDfnTitle:    function (dfn) {
        var title;
        if (dfn.hasAttribute("title")) title = dfn.getAttribute("title");
        else if (dfn.childNodes.length == 1 && dfn.firstChild.nodeType == Node.ELEMENT_NODE && 
                 (dfn.firstChild.localName.toLowerCase() == "abbr" || dfn.firstChild.localName.toLowerCase() == "acronym") &&
                 dfn.firstChild.hasAttribute("title")) title = dfn.firstChild.getAttribute("title");
        else title = dfn.textContent;
        title = this._norm(title);
        return title;
    },
    
    _norm:    function (str) {
        str = str.replace(/^\s+/, "").replace(/\s+$/, "");
        return str.split(/\s+/).join(" ");
    },
    
    _esc:    function (s) {
        s = s.replace(/&/g,'&amp;');
        s = s.replace(/>/g,'&gt;');
        s = s.replace(/"/g,'&quot;');
        s = s.replace(/</g,'&lt;');
        return s;
    },
};

berjon.WebIDLProcessor = function (cfg) {
    this.parent = { type: "module", id: "outermost", children: [] };
    if (!cfg) cfg = {};
    for (var k in cfg) this[k] = cfg[k];
};
berjon.WebIDLProcessor.prototype = {
    definition:    function (idl) {
        var def = { children: [] };
        var str = idl.getAttribute("title");
        str = this.parseExtendedAttributes(str, def);
        if      (str.indexOf("interface") == 0) this.interface(def, str, idl);
        else if (str.indexOf("exception") == 0) this.exception(def, str, idl);
        else if (str.indexOf("typedef") == 0)   this.typedef(def, str, idl);
        else if (/\bimplements\b/.test(str))     this.implements(def, str, idl);
        else    error("Expected definition, got: " + str);
        this.parent.children.push(def); // this should be done at the caller level
        this.processMembers(def, idl);
        return def;
    },
    
    interface:  function (inf, str, idl) {
        inf.type = "interface";
        var match = /^\s*interface\s+([A-Za-z][A-Za-z0-9]*)(?:\s+:\s*([^{]+)\s*)?/.exec(str);
        if (match) {
            inf.id = match[1];
            inf.refId = this._id(inf.id);
            if (match[2]) inf.superclasses = match[2].split(/\s*,\s*/);
        }
        else {
            error("Expected interface, got: " + str);
        }
        return inf;
    },
    
    exception:  function (exc, str, idl) {
        exc.type = "exception";
        var match = /^\s*exception\s+([A-Za-z][A-Za-z0-9]*)\s*/.exec(str);
        if (match) {
            exc.id = match[1];
            exc.refId = this._id(exc.id);
        }
        else error("Expected exception, got: " + str);
        return exc;
    },
    
    typedef:    function (tdf, str, idl) {
        tdf.type = "typedef";
        tdf.extendedAttributes = null; // remove them in case some were there by mistake
        var match = /^\s*typedef\s+(.+)\s+(\S+)\s*$/.exec(str);
        if (match) {
            var type = match[1];
            tdf.nullable = false;
            if (/\?$/.test(type)) {
                type = type.replace(/\?$/, "");
                tdf.nullable = true;
            }
            tdf.array = false;
            if (/\[\]$/.test(type)) {
                type = type.replace(/\[\]$/, "");
                tdf.array = true;
            }
            tdf.datatype = type;
            tdf.id = match[2];
            tdf.refId = this._id(tdf.id);
            tdf.description = sn.documentFragment();
            sn.copyChildren(idl, tdf.description);
        }
        else {
            error("Expected typedef, got: " + str);
        }
        return tdf;
    },
    
    implements: function (imp, str, idl) {
        imp.type = "implements";
        imp.extendedAttributes = null; // remove them in case some were there by mistake
        var match = /^\s*(.+?)\s+implements\s+(.+)\s*$/.exec(str);
        if (match) {
            imp.id = match[1];
            imp.refId = this._id(imp.id);
            imp.datatype = match[2];
            imp.description = sn.documentFragment();
            sn.copyChildren(idl, imp.description);
        }
        else {
            error("Expected implements, got: " + str);
        }
        return imp;
    },
    
    processMembers:    function (obj, el) {
        var exParent = this.parent;
        this.parent = obj;
        var dts = sn.findNodes("./dt", el);
        for (var i = 0; i < dts.length; i++) {
            var dt = dts[i];
            var dd = dt.nextElementSibling; // we take a simple road
            var mem = this.interfaceMember(dt, dd);
            obj.children.push(mem);
        }
        this.parent = exParent;
    },
    
    interfaceMember:    function (dt, dd) {
        var mem = { children: [] };
        var str = this._norm(dt.textContent);
        var extPrm = (sn.findNodes("dl[@class='parameters']", dd))[0];
        var excepts = sn.findNodes("*[@class='exception']", dd);
        var hadId = false;
        if (dd.id) hadId = true;
        else dd.id = "temporaryIDJustForCSS";
        dd.refId = this._id(dd.id);
        // var sgrs = sn.findNodes("*[@class='setraises' or @class='getraises' or]", dd);
        var sgrs = document.querySelectorAll("#" + dd.id + " .getraises, #" + dd.id + " .setraises");
        if (!hadId) dd.removeAttribute("id");
        mem.description = sn.documentFragment();
        sn.copyChildren(dd, mem.description);
        str = this.parseExtendedAttributes(str, mem);
        var match;
        
        // ATTRIBUTE
        match = /^\s*(?:(readonly)\s+)?attribute\s+\b(.*?)\s+(\S+)\s*$/.exec(str);
        if (match) {
            mem.type = "attribute";
            mem.readonly = (match[1] == "readonly");
            var type = match[2];
            mem.nullable = false;
            if (/\?$/.test(type)) {
                type = type.replace(/\?$/, "");
                mem.nullable = true;
            }
            mem.array = false;
            if (/\[\]$/.test(type)) {
                type = type.replace(/\[\]$/, "");
                mem.array = true;
            }
            mem.datatype = type;
            mem.id = match[3];
            mem.refId = this._id(mem.id);
            mem.raises = [];
            if (sgrs.length) {
                for (var i = 0; i < sgrs.length; i++) {
                    var el = sgrs[i];
                    var exc = {
                        id:     el.getAttribute("title"),
                        onSet:  sn.hasClass(el, "setraises"),
                        onGet:  sn.hasClass(el, "getraises"),
                    };
                    if (el.localName.toLowerCase() == "dl") {
                        exc.type = "codelist";
                        exc.description = [];
                        var dts = sn.findNodes("./dt", el);
                        for (var j = 0; j < dts.length; j++) {
                            var dt = dts[j];
                            var dd = dt.nextElementSibling;
                            var c = { id: dt.textContent, description: sn.documentFragment() };
                            sn.copyChildren(dd, c.description);
                            exc.description.push(c);
                        }
                    }
                    else if (el.localName.toLowerCase() == "div") {
                        exc.type = "simple";
                        exc.description = sn.documentFragment();
                        sn.copyChildren(el, exc.description);
                    }
                    else {
                        error("Do not know what to do with exceptions being raised defined outside of a div or dl.");
                    }
                    el.parentNode.removeChild(el);
                    mem.raises.push(exc);
                }
            }
            
            return mem;
        }
            
        // CONST
        match = /^\s*const\s+\b([^=]+\??)\s+([^=\s]+)\s*=\s*(.*)$/.exec(str);
        if (match) {
            mem.type = "constant";
            var type = match[1];
            mem.nullable = false;
            if (/\?$/.test(type)) {
                type = type.replace(/\?$/, "");
                mem.nullable = true;
            }
            mem.datatype = type;
            mem.id = match[2];
            mem.refId = this._id(mem.id);
            mem.value = match[3];
            return mem;
        }
            
        // METHOD
        match = /^\s*\b(.*?)\s+\b(\S+)\s*\(\s*(.*)\s*\)\s*$/.exec(str);
        if (match) {
            mem.type = "method";
            var type = match[1];
            mem.nullable = false;
            if (/\?$/.test(type)) {
                type = type.replace(/\?$/, "");
                mem.nullable = true;
            }
            mem.array = false;
            if (/\[\]$/.test(type)) {
                type = type.replace(/\[\]$/, "");
                mem.array = true;
            }
            mem.datatype = type;
            mem.id = match[2];
            mem.refId = this._id(mem.id);
            mem.params = [];
            var prm = match[3];
            mem.raises = [];
            
            if (excepts.length) {
                for (var i = 0; i < excepts.length; i++) {
                    var el = excepts[i];
                    var exc = { id: el.getAttribute("title") };
                    if (el.localName.toLowerCase() == "dl") {
                        exc.type = "codelist";
                        exc.description = [];
                        var dts = sn.findNodes("./dt", el);
                        for (var j = 0; j < dts.length; j++) {
                            var dt = dts[j];
                            var dd = dt.nextElementSibling;
                            var c = { id: dt.textContent, description: sn.documentFragment() };
                            sn.copyChildren(dd, c.description);
                            exc.description.push(c);
                        }
                    }
                    else if (el.localName.toLowerCase() == "div") {
                        exc.type = "simple";
                        exc.description = sn.documentFragment();
                        sn.copyChildren(el, exc.description);
                    }
                    else {
                        error("Do not know what to do with exceptions being raised defined outside of a div or dl.");
                    }
                    el.parentNode.removeChild(el);
                    mem.raises.push(exc);
                }
            }

            if (extPrm) {
                extPrm.parentNode.removeChild(extPrm);
                var dts = sn.findNodes("./dt", extPrm);
                for (var i = 0; i < dts.length; i++) {
                    var dt = dts[i];
                    var dd = dt.nextElementSibling; // we take a simple road
                    var prm = dt.textContent;
                    var p = {};
                    prm = this.parseExtendedAttributes(prm, p);
                    var match = /^\s*\b(.+?)\s+([^\s]+)\s*$/.exec(prm);
                    if (match) {
                        var type = match[1];
                        p.nullable = false;
                        if (/\?$/.test(type)) {
                            type = type.replace(/\?$/, "");
                            p.nullable = true;
                        }
                        p.array = false;
                        if (/\[\]$/.test(type)) {
                            type = type.replace(/\[\]$/, "");
                            p.array = true;
                        }
                        p.datatype = type;
                        p.id = match[2];
                        p.refId = this._id(p.id);
                        p.description = sn.documentFragment();
                        sn.copyChildren(dd, p.description);
                        mem.params.push(p);
                    }
                    else {
                        error("Expected parameter definition, got: " + prm);
                        break;
                    }
                }
            }
            else {
                while (prm.length) {
                    var p = {};
                    prm = this.parseExtendedAttributes(prm, p);
                    // either up to end of string, or up to ,
                    var re = /^\s*(?:in\s+)?\b([^,]+)\s+\b([^,\s]+)\s*(?:,)?\s*/;
                    var match = re.exec(prm);
                    if (match) {
                        prm = prm.replace(re, "");
                        var type = match[1];
                        p.nullable = false;
                        if (/\?$/.test(type)) {
                            type = type.replace(/\?$/, "");
                            p.nullable = true;
                        }
                        p.array = false;
                        if (/\[\]$/.test(type)) {
                            type = type.replace(/\[\]$/, "");
                            p.array = true;
                        }
                        p.datatype = type;
                        p.id = match[2];
                        p.refId = this._id(p.id);
                        mem.params.push(p);
                    }
                    else {
                        error("Expected parameter list, got: " + prm);
                        break;
                    }
                }
            }
            
            // apply optional
            var isOptional = false;
            for (var i = 0; i < mem.params.length; i++) {
                var p = mem.params[i];
                var pkw = p.datatype.split(/\s+/);
                var idx = pkw.indexOf("optional");
                if (idx > -1) {
                    isOptional = true;
                    pkw.splice(idx, 1);
                    p.datatype = pkw.join(" ");
                }
                p.optional = isOptional;
            }
            
            return mem;
        }

        // NOTHING MATCHED
        error("Expected interface member, got: " + str);
    },
    
    parseExtendedAttributes:    function (str, obj) {
        str = str.replace(/^\s*\[([^\]]+)\]\s+/, function (x, m1) { obj.extendedAttributes = m1; return ""; });
        return str;
    },
    
    makeMarkup:    function () {
        var df = sn.documentFragment();
        var pre = sn.element("pre", { "class": "idl" }, df);
        pre.innerHTML = this.writeAsWebIDL(this.parent, 0);
        df.appendChild(this.writeAsHTML(this.parent));
        return df;
    },

    writeAsHTML:    function (obj) {
        if (obj.type == "module") {
            if (obj.id == "outermost") {
                if (obj.children.length > 1) error("We currently only support one structural level per IDL fragment");
                return this.writeAsHTML(obj.children[0]);
            }
            else {
                warning("No HTML can be generated for module definitions.");
                return sn.element("span");
            }
        }
        else if (obj.type == "typedef") {
            var cnt;
            if (obj.description && obj.description.childNodes.length) {
                cnt = [obj.description];
            }
            else {
                // yuck -- should use a single model...
                var tdt = sn.element("span", { "class": "idlTypedefType" }, null);
                tdt.innerHTML = this.writeDatatype(obj.datatype);
                cnt = [ sn.text("Throughout this specification, the identifier "),
                        sn.element("span", { "class": "idlTypedefID" }, null, obj.id),
                        sn.text(" is used to refer to the "),
                        sn.text(obj.array ? "array of " : ""),
                        tdt,
                        sn.text(obj.nullable ? " (nullable)" : ""),
                        sn.text(" type.")];
            }
            return sn.element("div", { "class": "idlTypedefDesc" }, null, cnt);
        }
        else if (obj.type == "implements") {
            var cnt;
            if (obj.description && obj.description.childNodes.length) {
                cnt = [obj.description];
            }
            else {
                cnt = [ sn.text("All instances of the "),
                        sn.element("code", {}, null, [sn.element("a", {}, null, obj.id)]),
                        sn.text(" type are defined to also implement the "),
                        sn.element("a", {}, null, obj.datatype),
                        sn.text(" interface.")];
                cnt = [sn.element("p", {}, null, cnt)];
            }
            return sn.element("div", { "class": "idlImplementsDesc" }, null, cnt);
        }
        else if (obj.type == "interface" || obj.type == "exception") {
            var df = sn.documentFragment();
            var curLnk = "widl-" + obj.refId + "-";
            var types = ["attribute", "method", "constant"];
            for (var i = 0; i < types.length; i++) {
                var type = types[i];
                var things = obj.children.filter(function (it) { return it.type == type });
                if (things.length == 0) continue;
                if (!this.noIDLSorting) {
                    things.sort(function (a, b) {
                        if (a.id < b.id) return -1;
                        if (a.id > b.id) return 1;
                          return 0;
                    });
                }
                
                var sec = sn.element("section", {}, df);
                var secTitle = type;
                secTitle = secTitle.substr(0, 1).toUpperCase() + secTitle.substr(1) + "s";
                sn.element("h2", {}, sec, secTitle);
                var dl = sn.element("dl", { "class": type + "s" }, sec);
                for (var j = 0; j < things.length; j++) {
                    var it = things[j];
                    var dt = sn.element("dt", { id: curLnk + it.refId }, dl);
                    sn.element("code", {}, dt, it.id);
                    var desc = sn.element("dd", {}, dl, [it.description]);
                    if (type == "method") {
                        if (it.params.length) {
                            var table = sn.element("table", { "class": "parameters" }, desc);
                            var tr = sn.element("tr", {}, table);
                            ["Parameter", "Type", "Nullable", "Optional", "Description"].forEach(function (tit) { sn.element("th", {}, tr, tit); });
                            for (var k = 0; k < it.params.length; k++) {
                                var prm = it.params[k];
                                var tr = sn.element("tr", {}, table);
                                sn.element("td", { "class": "prmName" }, tr, prm.id);
                                var tyTD = sn.element("td", { "class": "prmType" }, tr);
                                var matched = /^sequence<(.+)>$/.exec(prm.datatype);
                                if (matched) {
                                    sn.element("code", {}, tyTD, [  sn.text("sequence<"), 
                                                                    sn.element("a", {}, null, matched[1]), 
                                                                    sn.text(">")]);
                                }
                                else {
                                    var cnt = [sn.element("a", {}, null, prm.datatype)];
                                    if (prm.array) cnt.push(sn.text("[]"));
                                    sn.element("code", {}, tyTD, cnt);
                                }
                                if (prm.nullable) sn.element("td", { "class": "prmNullTrue" }, tr, "\u2714");
                                else              sn.element("td", { "class": "prmNullFalse" }, tr, "\u2718");
                                if (prm.optional) sn.element("td", { "class": "prmOptTrue" }, tr, "\u2714");
                                else              sn.element("td", { "class": "prmOptFalse" }, tr, "\u2718");
                                var cnt = prm.description ? [prm.description] : "";
                                sn.element("td", { "class": "prmDesc" }, tr, cnt);
                            }
                        }
                        else {
                            sn.element("div", {}, desc, [sn.element("em", {}, null, "No parameters.")]);
                        }
                        if (it.raises.length) {
                            var table = sn.element("table", { "class": "exceptions" }, desc);
                            var tr = sn.element("tr", {}, table);
                            ["Exception", "Description"].forEach(function (tit) { sn.element("th", {}, tr, tit); });
                            for (var k = 0; k < it.raises.length; k++) {
                                var exc = it.raises[k];
                                var tr = sn.element("tr", {}, table);
                                sn.element("td", { "class": "excName" }, tr, [sn.element("a", {}, null, exc.id)]);
                                var dtd = sn.element("td", { "class": "excDesc" }, tr);
                                if (exc.type == "simple") {
                                    dtd.appendChild(exc.description);
                                }
                                else {
                                    var ctab = sn.element("table", { "class": "exceptionCodes" }, dtd );
                                    for (var m = 0; m < exc.description.length; m++) {
                                        var cd = exc.description[m];
                                        var tr = sn.element("tr", {}, ctab);
                                        sn.element("td", { "class": "excCodeName" }, tr, [sn.element("code", {}, null, cd.id)]);
                                        sn.element("td", { "class": "excCodeDesc" }, tr, [cd.description]);
                                    }
                                }
                            }
                        }
                        else {
                            sn.element("div", {}, desc, [sn.element("em", {}, null, "No exceptions.")]);
                        }
                        var reDiv = sn.element("div", {}, desc);
                        sn.element("em", {}, reDiv, "Return type: ");
                        var matched = /^sequence<(.+)>$/.exec(it.datatype);
                        if (matched) {
                            sn.element("code", {}, reDiv, [ sn.text("sequence<"), 
                                                            sn.element("a", {}, null, matched[1]), 
                                                            sn.text(">")]);
                        }
                        else {
                            var cnt = [sn.element("a", {}, null, it.datatype)];
                            if (it.array) cnt.push(sn.text("[]"));
                            sn.element("code", {}, reDiv, cnt);
                        }
                        if (it.nullable) sn.text(", nullable", reDiv);
                    }
                    else if (type == "attribute") {
                        sn.text(" of type ", dt);
                        if (it.array) sn.text("array of ", dt);
                        var span = sn.element("span", { "class": "idlAttrType" }, dt);
                        var matched = /^sequence<(.+)>$/.exec(it.datatype);
                        if (matched) {
                            sn.text("sequence<", span);
                            sn.element("a", {}, span, matched[1]);
                            sn.text(">", span);
                        }
                        else {
                            sn.element("a", {}, span, it.datatype);
                        }
                        if (it.readonly) sn.text(", readonly", dt);
                        if (it.nullable) sn.text(", nullable", dt);
                        
                        if (it.raises.length) {
                            var table = sn.element("table", { "class": "exceptions" }, desc);
                            var tr = sn.element("tr", {}, table);
                            ["Exception", "On Get", "On Set", "Description"].forEach(function (tit) { sn.element("th", {}, tr, tit); });
                            for (var k = 0; k < it.raises.length; k++) {
                                var exc = it.raises[k];
                                var tr = sn.element("tr", {}, table);
                                sn.element("td", { "class": "excName" }, tr, [sn.element("a", {}, null, exc.id)]);
                                ["onGet", "onSet"].forEach(function (gs) {
                                    if (exc[gs]) sn.element("td", { "class": "excGetSetTrue" }, tr, "\u2714");
                                    else         sn.element("td", { "class": "excGetSetFalse" }, tr, "\u2718");
                                });
                                var dtd = sn.element("td", { "class": "excDesc" }, tr);
                                if (exc.type == "simple") {
                                    dtd.appendChild(exc.description);
                                }
                                else {
                                    var ctab = sn.element("table", { "class": "exceptionCodes" }, dtd );
                                    for (var m = 0; m < exc.description.length; m++) {
                                        var cd = exc.description[m];
                                        var tr = sn.element("tr", {}, ctab);
                                        sn.element("td", { "class": "excCodeName" }, tr, [sn.element("code", {}, null, cd.id)]);
                                        sn.element("td", { "class": "excCodeDesc" }, tr, [cd.description]);
                                    }
                                }
                            }
                        }
                        else {
                            sn.element("div", {}, desc, [sn.element("em", {}, null, "No exceptions.")]);
                        }
                    }
                    else if (type == "constant") {
                        sn.text(" of type ", dt);
                        sn.element("span", { "class": "idlConstType" }, dt, [sn.element("a", {}, null, it.datatype)]);
                        if (it.nullable) sn.text(", nullable", dt);
                    }
                }
            }
            return df;
        }
    },
    
    writeAsWebIDL:    function (obj, indent) {
        if (obj.type == "module") {
            if (obj.id == "outermost") {
                var str = "";
                for (var i = 0; i < obj.children.length; i++) str += this.writeAsWebIDL(obj.children[i], indent);
                return str;
            }
            else {
                var str = "<span class='idlModule'>";
                if (obj.extendedAttributes) str += this._idn(indent) + "[<span class='extAttr'>" + obj.extendedAttributes + "</span>]\n";
                str += this._idn(indent) + "module <span class='idlModuleID'>" + obj.id + "</span> {\n";
                for (var i = 0; i < obj.children.length; i++) str += this.writeAsWebIDL(obj.children[i], indent + 1);
                str += this._idn(indent) + "};</span>\n";
                return str;
            }
        }
        else if (obj.type == "typedef") {
            var nullable = obj.nullable ? "?" : "";
            var arr = obj.array ? "[]" : "";
            return  "<span class='idlTypedef' id='idl-def-" + obj.refId + "'>typedef <span class='idlTypedefType'>" + 
                    this.writeDatatype(obj.datatype) +
                    "</span>" + arr + nullable + " <span class='idlTypedefID'>" + obj.id + "</span>;</span>";
        }
        else if (obj.type == "implements") {
            return  "<span class='idlImplements'><a>" + obj.id + "</a> implements <a>" + obj.datatype + "</a>;";
        }
        else if (obj.type == "interface") {
            var str = "<span class='idlInterface' id='idl-def-" + obj.refId + "'>";
            if (obj.extendedAttributes) str += this._idn(indent) + "[<span class='extAttr'>" + obj.extendedAttributes + "</span>]\n";
            str += this._idn(indent) + "interface <span class='idlInterfaceID'>" + obj.id + "</span>";
            if (obj.superclasses && obj.superclasses.length) str += " : " +
                                                obj.superclasses.map(function (it) {
                                                                        return "<span class='idlSuperclass'><a>" + it + "</a></span>"
                                                                    })
                                                                .join(", ");
            str += " {\n";
            // we process attributes and methods in place
            var maxAttr = 0, maxMeth = 0, maxConst = 0, hasRO = false;
            obj.children.forEach(function (it, idx) {
                var len = it.datatype.length;
                if (it.nullable) len = len + 1;
                if (it.array) len = len + 2;
                if (it.type == "attribute") maxAttr = (len > maxAttr) ? len : maxAttr;
                else if (it.type == "method") maxMeth = (len > maxMeth) ? len : maxMeth;
                else if (it.type == "constant") maxConst = (len > maxConst) ? len : maxConst;
                if (it.type == "attribute" && it.readonly) hasRO = true;
            });
            var curLnk = "widl-" + obj.refId + "-";
            for (var i = 0; i < obj.children.length; i++) {
                var ch = obj.children[i];
                if (ch.type == "attribute") str += this.writeAttribute(ch, maxAttr, indent + 1, curLnk, hasRO);
                else if (ch.type == "method") str += this.writeMethod(ch, maxMeth, indent + 1, curLnk);
                else if (ch.type == "constant") str += this.writeConst(ch, maxConst, indent + 1, curLnk);
            }
            str += this._idn(indent) + "};</span>\n";
            return str;
        }
        else if (obj.type == "exception") {
            var str = "<span class='idlException' id='idl-def-" + obj.refId + "'>";
            if (obj.extendedAttributes) str += this._idn(indent) + "[<span class='extAttr'>" + obj.extendedAttributes + "</span>]\n";
            str += this._idn(indent) + "exception <span class='idlExceptionID'>" + obj.id + "</span> {\n";
            var maxAttr = 0, maxConst = 0, hasRO = false;
            obj.children.forEach(function (it, idx) {
                var len = it.datatype.length;
                if (it.nullable) len = len + 1;
                if (it.array) len = len + 2;
                if (it.type == "attribute")   maxAttr = (len > maxAttr) ? len : maxAttr;
                else if (it.type == "constant") maxConst = (len > maxConst) ? len : maxConst;
                if (it.type == "attribute" && it.readonly) hasRO = true;
            });
            var curLnk = "widl-" + obj.refId + "-";
            for (var i = 0; i < obj.children.length; i++) {
                var ch = obj.children[i];
                if (ch.type == "attribute") str += this.writeAttribute(ch, maxAttr, indent + 1, curLnk, hasRO);
                else if (ch.type == "constant") str += this.writeConst(ch, maxConst, indent + 1, curLnk);
            }
            str += this._idn(indent) + "};</span>\n";
            return str;
        }
    },
    
    writeAttribute:    function (attr, max, indent, curLnk, hasRO) {
        var sets = [], gets = [];
        if (attr.raises.length) {
            for (var i = 0; i < attr.raises.length; i++) {
                var exc = attr.raises[i];
                if (exc.onGet) gets.push(exc);
                if (exc.onSet) sets.push(exc);
            }
        }
        
        var str = "<span class='idlAttribute'>";
        if (attr.extendedAttributes) str += this._idn(indent) + "[<span class='extAttr'>" + attr.extendedAttributes + "</span>]\n";
        str += this._idn(indent);
        if (hasRO) {
            if (attr.readonly) str += "readonly ";
            else               str += "         ";
        }
        str += "attribute ";
        var pad = max - attr.datatype.length;
        if (attr.nullable) pad = pad - 1;
        if (attr.array) pad = pad - 2;
        var nullable = attr.nullable ? "?" : "";
        var arr = attr.array ? "[]" : "";
        str += "<span class='idlAttrType'>" + this.writeDatatype(attr.datatype) + arr + nullable + "</span> ";
        for (var i = 0; i < pad; i++) str += " ";
        str += "<span class='idlAttrName'><a href='#" + curLnk + attr.refId + "'>" + attr.id + "</a></span>";
        if (gets.length) {
            str += " getraises (" +
                   gets.map(function (it) { return "<span class='idlRaises'><a>" + it.id + "</a></span>"; }).join(", ") +
                   ")";
        }
        if (sets.length) {
            str += " setraises (" +
                   sets.map(function (it) { return "<span class='idlRaises'><a>" + it.id + "</a></span>"; }).join(", ") +
                   ")";
        }
        str += ";</span>\n";
        return str;
    },
    
    writeMethod:    function (meth, max, indent, curLnk) {
        var str = "<span class='idlMethod'>";
        if (meth.extendedAttributes) str += this._idn(indent) + "[<span class='extAttr'>" + meth.extendedAttributes + "</span>]\n";
        str += this._idn(indent);
        var pad = max - meth.datatype.length;
        if (meth.nullable) pad = pad - 1;
        if (meth.array) pad = pad - 2;
        var nullable = meth.nullable ? "?" : "";
        var arr = meth.array ? "[]" : "";
        str += "<span class='idlMethType'>" + this.writeDatatype(meth.datatype) + arr + nullable + "</span> ";
        for (var i = 0; i < pad; i++) str += " ";
        str += "<span class='idlMethName'><a href='#" + curLnk + meth.refId + "'>" + meth.id + "</a></span> (";
        var obj = this;
        str += meth.params.map(function (it) {
                                    var nullable = it.nullable ? "?" : "";
                                    var optional = it.optional ? "optional " : "";
                                    var arr = it.array ? "[]" : "";
                                    var inp = obj.noIDLIn ? "" : "in ";
                                    var prm = "<span class='idlParam'>";
                                    if (it.extendedAttributes) prm += "[<span class='extAttr'>" + it.extendedAttributes + "</span>] ";
                                    prm += inp + optional + "<span class='idlParamType'>" + obj.writeDatatype(it.datatype) + arr + nullable + "</span> " +
                                    "<span class='idlParamName'>" + it.id + "</span>" +
                                    "</span>";
                                    return prm;
                                })
                          .join(", ");
        str += ")";
        if (meth.raises.length) {
            str += " raises ("
            str += meth.raises.map(function (it) { return "<span class='idlRaises'><a>" + it.id + "</a></span>"; })
                              .join(", ");
            str += ")";
        }
        str += ";</span>\n";
        return str;
    },
    
    writeConst:    function (cons, max, indent, curLnk) {
        var str = "<span class='idlConst'>";
        str += this._idn(indent);
        str += "const ";
        var pad = max - cons.datatype.length;
        if (cons.nullable) pad = pad - 1;
        var nullable = cons.nullable ? "?" : "";
        str += "<span class='idlConstType'><a>" + cons.datatype + "</a>" + nullable + "</span> ";
        for (var i = 0; i < pad; i++) str += " ";
        str += "<span class='idlConstName'><a href='#" + curLnk + cons.refId + "'>" + cons.id + "</a></span> = " +
               "<span class='idlConstValue'>" + cons.value + "</span>;</span>\n";
        return str;
    },

    writeDatatype:    function (dt) {
        var matched = /^sequence<(.+)>$/.exec(dt);
        if (matched) {
            return "sequence&lt;<a>" + matched[1] + "</a>&gt;";
        }
        else {
            return "<a>" + dt + "</a>";
        }
    },

    _idn:    function (lvl) {
        var str = "";
        for (var i = 0; i < lvl; i++) str += "    ";
        return str;
    },

    // XXX make this generally available (refactoring)
    _norm:    function (str) {
        str = str.replace(/^\s+/, "").replace(/\s+$/, "");
        return str.split(/\s+/).join(" ");
    },
    
    _id:    function (id) {
        return id.replace(/[^a-zA-Z_-]/g, "");
    },
};

// hackish, but who cares?
window.onload = function () {
    // (new berjon.respec()).run();
    (new berjon.respec()).loadAndRun();
};

function dbg (obj) {
    var str = "";
    for (var k in obj) str += k + "=" + obj[k] + "\n";
    alert("DUMP\n" + str);
}
})();
