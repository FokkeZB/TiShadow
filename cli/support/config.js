var path = require("path"),
    fs = require("fs"),
    os = require("os"),
    colors = require("colors"),
    logger = require("../../server/logger"),
    _ = require("underscore"),
    base,
    home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],
    platforms = ['iphone','android','blackberry','mobileweb','tizen'],
    tiapp = require("tiapp"),
    glob = require("glob"),
    config = {};

//get app name
function getAppName(callback) {
  tiapp.find(process.cwd(),function(err,result) {
    if (err) {
      logger.error("Script must be run within a Titanium project.");
      process.exit();
    }
    base = result.path; 
    var local_regex = /<key>CFBundleDevelopmentRegion<\/key>(\s|\n)*<string>(\w*)<\/string>/g
    var matches = local_regex.exec(result.str);
    if (matches) {
      config.locale = matches[2].split("_")[0];
    }
    callback(result.obj['ti:app']);
  });
}

//Default server setting
var config_path = path.join(home,'.tishadow.json');
if (fs.existsSync(config_path)) {
  config = require(config_path);
}

//Config setup
config.buildPaths = function(env, callback) {
  config.init(env);
  getAppName(function(result) {
    config.locale     = env.locale || config.locale;

    config.base              = base;
    config.alloy_path        = path.join(base, 'app');
    config.resources_path    = path.join(base, 'Resources');
    config.res_alloy_path    = path.join(base, 'Resources', 'alloy');
    config.fonts_path        = path.join(config.resources_path, 'fonts');
    config.modules_path      = path.join(base, 'modules');
    config.platform_path     = path.join(base, 'platform');
    config.spec_path         = path.join(base, 'spec');
    config.i18n_path         = path.join(base, 'i18n');
    config.build_path        = path.join(base, 'build');
    config.tishadow_build    = path.join(config.build_path, 'tishadow');
    config.tishadow_src      = path.join(config.tishadow_build, 'src');
    config.tishadow_spec     = path.join(config.tishadow_src, 'spec');
    config.tishadow_dist     = path.join(config.tishadow_build, 'dist');
    config.alloy_map_path    = path.join(config.tishadow_build, 'alloy_map.json');

    var app_name = config.app_name = result.name[0] || "bundle";
    config.bundle_file       = path.join(config.tishadow_dist, app_name + ".zip");
    config.jshint_path       = fs.existsSync(config.alloy_path) ? config.alloy_path : config.resources_path;
    if (config.isTiCaster && result.ticaster_user[0] && result.ticaster_app[0]) {
      config.room = result.ticaster_user[0] + ":" + result.ticaster_app[0];
    }
    if (config.room === undefined) {
      logger.error("ticaster setting missing from tiapp.xml");
      process.exit();
    }
    config.isAlloy = fs.existsSync(config.alloy_path);
    if (!config.platform && config.isAlloy) {
      var deploymentTargets = [];
      result['deployment-targets'][0].target.forEach(function(t) {
        if (t['_'] === 'true') {
          var platform = t['$'].device;
          if (platform === 'ipad' || platform === 'iphone') {
            if (deploymentTargets.indexOf('ios') !== -1) {
              return;
            }
            platform = 'ios';
          }
          deploymentTargets.push(platform);
        }
      });
      config.platform = deploymentTargets;
    }
    config.last_updated_file = path.join(config.tishadow_build, 'last_updated' + (config.platform ? '_' + config.platform.join('_') : ''));
    config.isPatch = env.patch;
    config.isUpdate = (env.update || env.patch) 
                    && fs.existsSync(config.tishadow_src)
                    && fs.existsSync(config.last_updated_file);

    if (config.isSpec) {
      config.specCount = _.uniq(glob.sync(config.spec_path +"/**/*_spec.js").concat(glob.sync(config.resources_path + "/**/*_spec.js"))).length;
    }
    callback();
  });
};

config.init = function(env) {
  config.isSpec     = env._name === "spec";
  config.specType   = env.type || config.type  || "jasmine"
  config.watchInterval = config.watchInterval || 100;
  config.watchDelay    = config.watchDelay || 0;
  if (['jasmine','mocha-chai','mocha-should'].indexOf(config.specType) === -1) {
    logger.error("Invalid test library, please choose from: jasmine, mocha-should or mocha-chai");
    process.exit(-1);
  }
  config.isDeploy   = env._name === "deploy";
  config.isTailing  = env.tailLogs || config.isSpec;
  config.isJUnit    = env.junitXml;
  config.isREPL     = env._name === "repl";
  config.isPipe     = env.pipe;
  config.isBundle   = env._name === "bundle";
  config.isTiCaster = env.ticaster;
  if (!env.ticaster) {
    config.host     = env.host || config.host || "localhost";
    config.port     = env.port || config.port || "3000";
    config.room     = env.room || config.room || "default";
  } else {
    config.host     = "www.ticaster.io";
    config.port     = 443;
  }
  config.screenshot_path = env.screenshotPath || os.tmpdir();
  config.internalIP = env.internalIp;
  config.isLongPolling = env.longPolling;
  config.isManageVersions = env.manageVersions;
  config.platform = (env.platform && env.platform !== 'all') ? env.platform.split(',') : undefined;
};

config.write = function(env) {
  var new_config = {};
  if (fs.existsSync(config_path)) {
    new_config = require(config_path);
  }
  ['host','port','room', 'type', 'watchInterval', 'watchDelay'].forEach(function(param) {
    if (env[param] !== undefined) {
      new_config[param] = env[param];
    }
  });
  var config_text = JSON.stringify(new_config, null, 4);
  console.log(config_text.grey);
  console.log("TiShadow configuration file updated.");
  fs.writeFileSync(config_path, config_text);
};


module.exports = config;
