'use strict';

const obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    "web_host": "mywiki.zapto.org",
    "username": "",
    "password": "",
    "local_images_folder": "Visual Aids",
    "remote_images_folder": "",
};

class VisualAidPlugin extends obsidian.Plugin {
    async onload() {
        new Notice("Enabled");
        this.registerMarkdownPostProcessor(async (el, ctx) => {
            const a_elements = el.querySelectorAll("a");
            for (let index = 0; index < a_elements.length; index++) {
                // Retrieve URL and text from original <a>
                const a_element = a_elements.item(index);
                const link_text = a_element.innerText;
                if (!link_text.endsWith("^"))
                    continue;
                // Remove caret from link text
                a_element.innerText = link_text.substring(0, link_text.length - 1);
                a_element.classList.add("visual-aid-link");
                a_element.onclick = (event) => set_visual_aid(event, this.settings);
            }
            console.log(el);
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

async function set_visual_aid(event, settings) {
    event.preventDefault();
    event.stopPropagation();
    let formData = new FormData();
    formData.append("action", "visual_aid");
    formData.append("player_soundboard", false);
    formData.append("title", event.altKey ? event.target.innerText : "");
    let href = event.target.getAttribute("href");
    const class_list = event.target.classList;
    if (class_list.contains("internal-link")) {
        formData.append("url", `http://${settings.web_host}/media/img/visual_aids/${settings.remote_images_folder}/${href}`);
        if (!class_list.contains("is-unresolved"))
            // If internal link is resolved, check if we need to upload the file to the visual aid server first
            await upload_visual_aid(href, settings);
    } else if (class_list.contains("external-link")) {
        formData.append("url", href);
    } else {
        console.error(`Invalid classList: ${class_list}`);
    }
    console.log(formData);
    if (event.ctrlKey) {
        set_visual_aid_response(formData.get("url"));
    } else {
        await fetch_visual_aid("set_visual_aid", "POST", formData, settings);
    }
}

function set_visual_aid_response(url) {
    if (url) {
        window.open(url, "", "");
    }
}

async function upload_visual_aid(filename, settings) {
    const local_path = `${settings.local_images_folder}/${filename}`;
    console.log(local_path);
    const remote_path = `${settings.remote_images_folder}/${filename}`;
    const abstract_file = app.vault.getAbstractFileByPath(local_path);
    console.log(abstract_file);
    const content = await app.vault.readBinary(abstract_file);
    console.log(content);
    // Check with the webserver if we need to upload the image
    let formData = new FormData();
    formData.append("target_path", remote_path);
    formData.append("image_size", content.byteLength);
    let r = await fetch_visual_aid("check_visual_aid", "POST", formData, settings);
    console.log(r);
    const j = await r.json();
    console.log(j);
    if (j["size_matches"])
        // The file exists and is the same size. Don't bother uploading.
        // TODO compare md5 hash
        return;
    const image_type = `image/${abstract_file.extension}`
    let blob = new Blob([new Uint8Array(content)],{type: image_type})
    console.log(blob);
    const file = new File([blob], filename,{type: image_type});
    console.log(file);
    formData = new FormData();
    formData.append("image", file);
    formData.append("target_path", remote_path);
    await fetch_visual_aid("upload_visual_aid", "PUT", formData, settings);
}

async function fetch_visual_aid(url, method, formData, settings) {
    const credentials = btoa(settings.username + ":" + settings.password);
    let r = await fetch(
        `http://${settings.web_host}/${url}`,
        {
            method: method,
            body: formData,
            headers: {
                "Authorization": "Basic " + credentials,
            }
        }
    );
    console.log('HTTP response code:', r.status);
    return r;
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
        // Local visual aid images folder
        new obsidian.Setting(containerEl)
            .setName("Visual aid images folder (local)")
            .setDesc("The name of the folder where you store all your visual aid images on Obsidian")
            .addText(text => text
                .setValue(this.plugin.settings.local_images_folder)
                .onChange(async (value) => {
                    this.plugin.settings.local_images_folder = value;
                    await this.plugin.saveSettings();
                })
            );
        // Remote visual aid images folder
        new obsidian.Setting(containerEl)
            .setName("Visual aid images folder (remote)")
            .setDesc("The name of the folder where you store all your visual aid images on the visual aid server")
            .addText(text => text
                .setValue(this.plugin.settings.remote_images_folder)
                .setPlaceholder("e.g. curse_of_strahd")
                .onChange(async (value) => {
                    this.plugin.settings.remote_images_folder = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}