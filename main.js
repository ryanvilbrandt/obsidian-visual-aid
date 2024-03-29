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
        new Notice("Visual Aid Controller enabled");
        this.registerMarkdownPostProcessor(async (el, ctx) => {
            const a_elements = el.querySelectorAll("a");
            for (let index = 0; index < a_elements.length; index++) {
                // Retrieve URL and text from original <a>
                init_visual_aid_link(a_elements.item(index), this.settings);
            }
            console.debug(el);
        });
        this.registerMarkdownCodeBlockProcessor("audio-file", (source, el, ctx) => {
            console.log(this.settings);
            init_audio_file_block(source, el, ctx, this.settings);
        });
        await this.loadSettings();
    }
    onunload() {
        new Notice("Visual Aid Controller disabled");
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

function init_visual_aid_link(element, settings) {
    // Retrieve URL and text from original <a>
    const link_text = element.innerText;
    // Check for visual aid
    if (link_text.endsWith("^")) {  // Visual aid
        // Remove caret from link text
        element.innerText = link_text.substring(0, link_text.length - 1);
        element.classList.add("visual-aid-link");
        element.onclick = (event) => set_visual_aid(event, settings);
    }
}

function init_audio_file_block(source, el, ctx, settings) {
    // Determine filename and looping rules
    let source_lines = source.split("\n");
    const commands = source_lines[0].split("|");
    const filename = commands.at(-1);
    const display_name = filename.split(".")[0];
    let action, sound_type;
    // Action: load, play, pause, or stop
    if (commands.contains("controls"))
        action = "controls";
    else if (commands.contains("play"))
        action = "play";
    else if (commands.contains("pause"))
        action = "pause";
    else if (commands.contains("stop"))
        action = "stop";
    else
        action = "load";
    // Sound type: music, ambience, or effect
    if (commands.contains("ambience"))
        sound_type = "ambience";
    else if (commands.contains("effect"))
        sound_type = "effect";
    else if (commands.contains("all"))
        sound_type = "all";
    else
        sound_type = "music";
    console.debug(`display_name=${display_name} | filename=${filename} | action=${action} | sound_type=${sound_type}`);
    // Create nodes
    if (action === "controls") {
        el.appendChild(create_audio_controls(settings));
    } else {
        const blockquote = document.createElement("blockquote");
        const audio_link = document.createElement("a");
        if (action === "load") {
            const play_span = document.createElement("span");
            play_span.innerHTML = `<strong>Load ${sound_type}:</strong> `;
            blockquote.appendChild(play_span);
            audio_link.innerText = display_name;
            audio_link.href = `${action}|${sound_type}|${filename}`;
        } else {
            audio_link.innerText = `${toTitleCase(action)} ${sound_type}`;
            audio_link.href = `${action}|${sound_type}`;
        }
        console.log(audio_link);
        audio_link.onclick = (event) => set_audio_file(event, settings);
        blockquote.appendChild(audio_link);
        el.appendChild(blockquote);
    }
    console.debug(el);
}


function create_audio_controls(settings) {
    const controls_div = document.createElement("div");
    controls_div.id = "audio-controls-div";
    const actions = [
        {
            "action": "play",
            "label": "<svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" class=\"w-6 h-6\">\n" +
                "  <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z\" />\n" +
                "</svg>"
        },
        {
            "action": "pause",
            "label": "<svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" class=\"w-6 h-6\">\n" +
                "  <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 5.25v13.5m-7.5-13.5v13.5\" />\n" +
                "</svg>"
        },
        {
            "action": "stop",
            "label": "<svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" class=\"w-6 h-6\">\n" +
                "  <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z\" />\n" +
                "</svg>"
        },
    ];
    for (const i in actions) {
        const control_div = document.createElement("div");
        const audio_link = document.createElement("a");
        audio_link.innerHTML = actions[i]["label"];
        audio_link.href = `${actions[i]["action"]}|all`;
        audio_link.onclick = (event) => set_audio_file(event, settings);
        control_div.appendChild(audio_link);
        controls_div.appendChild(control_div);
    }
    return controls_div
}


function toTitleCase(s) {
    return s.charAt(0).toUpperCase() + s.toLowerCase().slice(1);
}


async function set_visual_aid(event, settings) {
    event.preventDefault();
    event.stopPropagation();
    let body = {
        "action": "visual_aid",
        "player_soundboard": false,
        "title": event.altKey ? event.target.innerText : ""
    };
    let href = event.target.getAttribute("href");
    const class_list = event.target.classList;
    if (class_list.contains("internal-link")) {
        body["url"] = `http://${settings.web_host}/media/img/visual_aids/${settings.remote_images_folder}/${href}`;
        if (!class_list.contains("is-unresolved"))
            // If internal link is resolved, check if we need to upload the file to the visual aid server first
            if (!await upload_visual_aid(href, settings))
                return;
    } else if (class_list.contains("external-link")) {
        body["url"] = href;
    } else {
        console.error(`Invalid classList: ${class_list}`);
    }
    console.debug(body);
    if (event.ctrlKey) {
        set_visual_aid_response(body.get("url"));
    } else {
        new Notice(`Sending ${href} to visual aid`);
        await fetch_visual_aid("set_visual_aid", "POST", JSON.stringify(body), settings);
    }
}


async function set_audio_file(event, settings) {
    event.preventDefault();
    event.stopPropagation();
    let target = event.target;
    if (target.tagName !== "a") {
        target = target.closest("a");
    }
    console.debug(target);
    let commands = target.href;
    commands = commands.split(document.domain)[1].slice(1).replace(/%7C/g, "|");
    console.debug(commands)
    const commands_list = commands.split("|");
    console.log(commands_list);
    let body = {
        "action": commands_list[0],
        "target": commands_list[1],
        "url": null,
    }
    if (commands_list.length === 3) {
        body["url"] = `media/audio/${settings.remote_images_folder}/${commands_list[2]}`;
    }
    console.log(body);
    let r = await fetch_visual_aid("set_visual_aid", "POST", JSON.stringify(body), settings);
    if (r === null) {
        new Notice(`Visual aid call to set_visual_aid failed`);
    } else {
        new Notice(`Sent ${commands} to visual aid`);
    }
}



async function set_audio_file(event, settings) {
    event.preventDefault();
    event.stopPropagation();
    let target = event.target;
    if (target.tagName !== "a") {
        target = target.closest("a");
    }
    console.debug(target);
    let commands = target.href;
    commands = commands.split(document.domain)[1].slice(1).replace(/%7C/g, "|");
    console.debug(commands)
    const commands_list = commands.split("|");
    console.log(commands_list);
    let formData = new FormData();
    formData.append("action", commands_list[0]);
    formData.append("target", commands_list[1]);
    let url = null;
    if (commands_list.length === 3) {
        url = `media/audio/${settings.remote_images_folder}/${commands_list[2]}`;
    }
    formData.append("url", url);
    console.log(formData);
    let r = await fetch_visual_aid("set_visual_aid", "POST", formData, settings);
    if (r === null) {
        new Notice(`Visual aid call to set_visual_aid failed`);
    } else {
        new Notice(`Sent ${commands} to visual aid`);
    }
}


function set_visual_aid_response(url) {
    if (url) {
        window.open(url, "", "");
    }
}

async function upload_visual_aid(filename, settings) {
    const local_path = `${settings.local_images_folder}/${filename}`;
    console.debug(`Local path: ${local_path}`);
    const remote_path = `${settings.remote_images_folder}/${filename}`;
    const abstract_file = app.vault.getAbstractFileByPath(local_path);
    console.debug(`Abstract file: ${abstract_file}`);
    if (abstract_file === null) {
        new Notice(`"${local_path}" not found`);
        return false;
    }
    const content = await app.vault.readBinary(abstract_file);
    console.debug(content);
    // Check with the webserver if we need to upload the image
    let body = {
        "target_path": remote_path,
        "image_size": content.byteLength,
    };
    let r = await fetch_visual_aid("check_visual_aid", "POST", JSON.stringify(body), settings);
    console.debug(r);
    if (r === null) {
        new Notice("Visual aid call to check_visual_aid failed\nDo you have the correct web host and credentials?");
        return false;
    }
    const j = r.json;
    console.debug(j);
    if (j["size_matches"])
        // The file exists and is the same size. Don't bother uploading.
        // TODO compare md5 hash
        return true;
    // Create file with metadata to upload
    new Notice(`Uploading ${remote_path} to media server...`);
    const metadata = {"target_path": remote_path};
    const combinedBuffer = prependMetadataToArrayBuffer(metadata, content);
    r = await fetch_visual_aid("upload_visual_aid", "PUT", combinedBuffer, settings);
    if (r === null) {
        new Notice(`Visual aid call to upload_visual_aid failed\nDo you have the correct remote path? (${remote_path})`);
    } else {
        new Notice(`Done uploading ${remote_path}`);
    }
    return true;
}

function prependMetadataToArrayBuffer(metadata, arrayBuffer) {
    const textEncoder = new TextEncoder();
    const metadataBuffer = textEncoder.encode(JSON.stringify(metadata) + "\n").buffer;
    // Combine the original and metadata ArrayBuffer
    let combinedBuffer = new ArrayBuffer(arrayBuffer.byteLength + metadataBuffer.byteLength);
    // Create views for the original and metadata buffers
    let metadataView = new Uint8Array(metadataBuffer);
    let originalView = new Uint8Array(arrayBuffer);
    let combinedView = new Uint8Array(combinedBuffer);
    // Copy the original data into the combined buffer
    combinedView.set(metadataView, 0);
    // Inject metadata at the end of the combined buffer
    combinedView.set(originalView, metadataView.byteLength);
    return combinedView.buffer;
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

async function fetch_visual_aid(url, method, body, settings) {
    const long_url = `${settings.web_host}/${url}`;
    const credentials = btoa(settings.username + ":" + settings.password);
    const params = {
        url: long_url,
        method: method,
        body: body,
        headers: {
            "Authorization": "Basic " + credentials,
        }
    };
    console.debug(params);
    return await obsidian.requestUrl(params);
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