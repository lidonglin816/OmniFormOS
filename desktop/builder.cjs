module.exports={
  appId:'com.omniformos.desktop',productName:'OmniFormOS',executableName:'OmniFormOS',
  directories:{output:'output/desktop'},
  electronDist:'node_modules/electron/dist',
  asar:false,npmRebuild:false,
  files:['desktop/**','server.mjs','src/**','public/**','package.json','!desktop/builder.cjs'],
  extraResources:[{from:process.execPath,to:'runtime/node.exe'}],
  // Backend uses the bundled Node runtime; its files and native dependencies must be real paths.
  win:{target:[{target:'nsis',arch:['x64']}],icon:'desktop/icon.ico',signAndEditExecutable:false},
  nsis:{oneClick:false,allowToChangeInstallationDirectory:true,perMachine:false,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'OmniFormOS',deleteAppDataOnUninstall:false},
  artifactName:'OmniFormOS-Desktop-${version}-${arch}-Setup.${ext}',
  extraMetadata:{main:'desktop/main.cjs',version:'1.2.0',description:'OmniFormOS 八大引擎桌面工作区',author:'OmniFormOS'},
};
