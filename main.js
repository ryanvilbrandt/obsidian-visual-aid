'use strict';

const obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    "web_host": "mywiki.zapto.org",
    "username": "",
    "password": "",
};

class VisualAidPlugin extends obsidian.Plugin {
    async onload() {
        new Notice("Enabled");
        this.registerMarkdownPostProcessor(async (el, ctx) => {
            console.log("==============");
            const a_elements = el.querySelectorAll("a");
            for (let index = 0; index < a_elements.length; index++) {
                // Retrieve URL and text from original <a>
                const a_element = a_elements.item(index);
                let href = a_element.getAttribute("href");
                if (!href)
                    continue;
                let href_start = href[0];
                let href_end = href.substring(1, href.length);
                const link_text = a_element.innerText;
                // Check for specifically either visual aid or soundboard
                let title, inner_html;
                if (href_start === "^") {
                    title = `visual_aid|${href_end}|${link_text}`;
                    const url = !href_end.startsWith("http") ? `${SERVER}/media/img/visual_aids/${href_end}` : href_end;
                    const hover_panel = `<span class="visual-aid-hover"><img class="visual-aid-hover-img" src="${url}"></span>`;
                    inner_html = `${link_text}${hover_panel}`;
                } else if (href_start === "$") {
                    title = href_end;
                    inner_html = link_text;
                } else {
                    continue;
                }
                // Replace <a> with span
                const link_span = document.createElement("span");
                link_span.className = "visual-aid-link";
                link_span.title = title;
                link_span.innerHTML = inner_html;
                link_span.onclick = (event) => set_visual_aid(event, link_span.title, this.settings);
                insertAfter(link_span, a_element);
                a_element.parentNode.removeChild(a_element);
            }
            // console.log(el);
        });
        await this.loadSettings();
    }
    onunload() {
        new Notice("Disabled");
    }
    // Load the settings.
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.addSettingTab(new VisualAidSettingsTab(this.app, this));
    }
    // Save the settings.
    async saveSettings() {
        await this.saveData(this.settings);
    }
}
module.exports = VisualAidPlugin;

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function set_visual_aid(event, value, settings) {
    let array = value.split("|");
    let action = array[0]
    let params = {
        "action": action,
        "player_soundboard": false
    };
    if (action === "visual_aid") {
        let url = array[1];
        if (url && !url.startsWith("http")) {
            url = `${settings.web_host}/media/img/visual_aids/${url}`;
        }
        let title = array.length >= 3 ? array[2] : "";
        params["url"] = url;
        params["title"] = event.altKey ? title : "";
    } else if (action === "iframe") {
        params["url"] = array[1];
    } else {
        params["target"] = array[1];
        if (array.length === 3) {
            let url = array[2];
            if (url && !url.startsWith("http")) {
                url = `${settings.web_host}/media/audio/${url}`;
            }
            params["url"] = url;
        }
    }
    if (event.ctrlKey) {
        set_visual_aid_response(params["url"]);
    } else {
        ajax_call(`${settings.web_host}/set_visual_aid`, null, params, null, true, settings);
    }
}

function set_visual_aid_response(url) {
    if (url) {
        window.open(url, "", "");
    }
}

function ajax_call(url, func, params=null, error_func=null, auth=false, settings=null) {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState === 4) {
            if (this.status === 200) {
                if (func) {
                    func(this);
                }
            } else {
                console.error(xhttp);
                if (error_func) {
                    error_func(this);
                }
            }
        }
    };
    xhttp.open(params === null ? "GET" : "POST", url, true);
    xhttp.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    if (auth) {
        const credentials = btoa(settings.username + ":" + settings.password);
        xhttp.setRequestHeader ("Authorization", "Basic " + credentials);
    }
    if (params === null) {
        xhttp.send();
    } else {
        let post_params;
        if (typeof params === "string") {
            post_params = params;
        } else {
            post_params = Object.keys(params).map(
                k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])
            ).join("&");
        }
        xhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhttp.send(post_params);
    }
}

class VisualAidSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl("h1", {text: "Visual Aid controller"});
        // Web Host
        new obsidian.Setting(containerEl)
            .setName("Web Host")
            .setDesc("The domain of the visual aid server")
            .addText(text => text
                .setValue(this.plugin.settings.web_host)
                .setPlaceholder("e.g. mywiki.zapto.org")
                .onChange(async (value) => {
                    this.plugin.settings.web_host = value;
                    await this.plugin.saveSettings();
                })
            );
        // Username
        new obsidian.Setting(containerEl)
            .setName("Username")
            .setDesc("Your username to login to the server")
            .addText(text => text
                .setValue(this.plugin.settings.username)
                .onChange(async (value) => {
                    this.plugin.settings.username = value;
                    await this.plugin.saveSettings();
                })
            );
        // Password
        new obsidian.Setting(containerEl)
            .setName("Password")
            .setDesc("Your password to login to the server")
            .addText(text => text
                .setValue(this.plugin.settings.password)
                .onChange(async (value) => {
                    this.plugin.settings.password = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}