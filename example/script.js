import {compile, Version} from "../build/spirv4web.module.js";

const versions = {
    webgl1: Version.WebGL1,
    webgl2: Version.WebGL2
};

function load(file)
{
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("GET", file, true);
        request.responseType = "arraybuffer";
        request.onload = function () {
            const arrayBuffer = request.response;
            if (arrayBuffer) {
                resolve(arrayBuffer);
            }
        };

        request.send(null);
    })
}

function generate()
{
    const time = performance.now();
    const version = document.getElementById("version").value;
    const stage = document.getElementById("stage").value;
    const file = stage === "vertex"? "tmp_default_unlit.vert.spv" : "tmp_default_unlit.frag.spv";
    load(file).then((data) => {
        const code = compile(data, versions[version]);
        document.getElementById("compiledShader").innerHTML = code;
    });
    console.log((performance.now() - time) + "ms");
}

window.onload = () => {
    document.getElementById("generateButton").addEventListener("click", () => generate());
}