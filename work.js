// mapbox streets tile layer
var mapboxStreets = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1IjoiZGVseW5rbyIsImEiOiJjaXBwZ3hkeTUwM3VuZmxuY2Z5MmFqdnU2In0.ac8kWI1ValjdZBhlpMln3w'
});

// county boundaries from ArcGIS feature layer
var countyBoundaries = L.esri.featureLayer({
    url: "https://services3.arcgis.com/9ntQlfNHEhmpX4cl/arcgis/rest/services/TriCountyBoundary/FeatureServer/0",
    style:{
        "color": "#000000",
        "fillOpacity": 0,
        "weight": 2
    },
    interactive: false
});

// create map
var map = L.map("map", {
    maxZoom: 18,
    layers: [mapboxStreets, countyBoundaries],
    home: true
}).setView([39.52, -105.41], 10);

// create draw control
var drawControl = new L.Control.Draw({
    draw: {
        // remove unnecessary buttons
        polyline: false,
        circle: false,
        rectangle: false,
        polygon: false,
    }
});

// add draw control to map
map.addControl(drawControl);

// add "You are here" icon to the map at the laramie building
var jobCenter = L.marker([39.73395,-105.21106],{
    icon: starIcon,
}).bindPopup('<p style="text-align: center"><b>Jefferson County Workforce Center</b><br>(You are here)</p>').addTo(map);

// bus route layer
var busRouteLayer = L.esri.featureLayer({
    url: "https://services3.arcgis.com/9ntQlfNHEhmpX4cl/arcgis/rest/services/RTDBusRoutes/FeatureServer/0",
    style: {
        color: "#ff6600",
        dashArray: "3, 15",
        weight: 1.5
    },
    onEachFeature: function(feature, layer){
        layer.bindPopup('<h4>RTD Bus Route</h4>' + 
                        '&nbsp;Route: <b>' + layer.feature.properties.ROUTE + '</b><br>' +
                        '&nbsp;Route Name: <b>' + layer.feature.properties.NAME + '</b><br>'                       
                       );
    }
});

// child care layer group in which to put facilitiy data and add to layer control
var ccLayer = L.layerGroup();
// child care facility url (state maintained and available via API)
var childCareURL = "https://data.colorado.gov/resource/c3mb-e5ey.geojson?$$app_token=KNDmNZ8IqYwXEtg9QyjSgmq21";
// api call for child care facility geojson data
$.getJSON(childCareURL, function(data){
    var cc = L.geoJson(data, {
        onEachFeature: function (feature, layer) {
            // popup definition for each feature in child care facility data
            layer.bindPopup(
                'Facility Type: <b>' + feature.properties.provider_service_type +
                '</b><br>Facility Name: <b>' + feature.properties.provider_name +
                '</b><br>Address: <b>' + feature.properties.street_address +
                '</b><br>City: <b>' + feature.properties.city + 
                '</b><br>Community: <b>' + feature.properties.community +
                '</b><br>Capacity: <b>' + feature.properties.total_licensed_capacity
            );
            // set icon to child care facilities
            layer.setIcon(ccIcon);
        }
    });
    // add child car facility points to 'ccLayer' layerGroup
    cc.addTo(ccLayer);
});

// object to define layers for layer control
controlLayers = {
    "Child Care Facilities": ccLayer,
    "RTD Bus Routes": busRouteLayer
//    "RTD Light Rail Stops": railPoints
};

// add layer control to the map
L.control.layers([], controlLayers).addTo(map);

// event that starts everything once a point on the map is selected
map.on(L.Draw.Event.CREATED, function (e) {
    
    // Add marker to selected point on map
    L.marker([e.layer._latlng.lat, e.layer._latlng.lng], {
        icon: resultIcon
    }).bindPopup("Your selected location").addTo(map);
    
    // center and zoom the map to the selected point
    map.setView([e.layer._latlng.lat, e.layer._latlng.lng], 12);
    
    // call the jobZIPS function
    jobZIPS(e.layer._latlng);
    
    // call the searchJobs function
    searchJobs(e.layer._latlng);
    
    // call the setAccordian function
    setTimeout(function(){
        setAccordion();
    }, 550);
        
    // fadeout to remove the intro text/instructions and fadein the eventual job list
    $("#intro").fadeOut("slow");
    
    // bring the populated job list into view
    setTimeout(function(){
        $("#jobList").fadeIn("slow");
    }, 1000);
});

// applies refresh function to "New Search" button
$("#rb").click(function(){
    location.reload();
});

//sets the accordion functionality to the zip code divs
function setAccordion(){
    var acc = document.getElementsByClassName("accordion");
    var i;
    for (i = 0; i < acc.length; i++) {
        acc[i].onclick = function(){
            this.classList.toggle("active");
            var panel = this.nextElementSibling;
            if (panel.style.display === "block") {
                panel.style.display = "none";
            } else {
                panel.style.display = "block";
            }
        }
    }
}

function jobZIPS(point){
    
    // style definition for zip codes when added to map
    var zipOriginalStyle = {
        color: "#263F6A",
        fillOpacity: 0,
        weight: 4
    };

    // style definition for zip codes when corresponding element is hovered over
    var zipHoverStyle = {
        color: "#263F6A",
        fillOpacity: 0.3,
        fillColor: "#263F6A",
        weight: 4
    };
    
    // using the geometry of the selected point, query the zip_code feature service for zip codes within a mile of the point, add them to the map, and create respective buttons in jobList div
    var zipCodesURL = "https://services3.arcgis.com/9ntQlfNHEhmpX4cl/arcgis/rest/services/zip_code/FeatureServer/0";
    L.esri.query({
        url: zipCodesURL
    }).where("OBJECTID > 0").nearby(point, 1609.34).run(function(error, data){
        var zips = L.geoJson(data, {
            onEachFeature: function(feature, layer){
                
                // add popup to zip code layer
                layer.bindPopup(feature.properties.ZIP);

                // variable for jobList div...container for all job search results. This div exists already in the index.html file with a class of .hidden
                var jobList = document.getElementById('jobList');
                
                // create a new button for each zip code within a mile of selected point and append it to jobList div
                var zipDiv = document.createElement('button');
                zipDiv.id = feature.properties.ZIP;
                zipDiv.className = "zipTitle accordion";
                // function to change the color of both the div and the associated ZIP code on the map when the div is selected/hovered over
                zipDiv.onmouseover = function(){
                    var zip = this.id;
                    map.eachLayer(function(layer){
                        if (layer.hasOwnProperty("feature")){
                            if (layer.feature.properties.hasOwnProperty("ZIP")){
                                if (layer.feature.properties.ZIP == zip){
                                    layer.setStyle(zipHoverStyle);
                                }
                            }
                        }
                    });
                };
                // function to restore the color of both the div and the associated ZIP code on the map when the div is de-selected/un-hovered over
                zipDiv.onmouseout = function(){
                    var zip = this.id;
                    map.eachLayer(function (layer) {
                        if (layer.hasOwnProperty("feature")) {
                            if (layer.feature.properties.hasOwnProperty("ZIP")) {
                                if (layer.feature.properties.ZIP == zip){
                                    layer.setStyle(zipOriginalStyle);
                                }
                            }
                        }
                    });
                };
                zipDiv.innerHTML = `<b>Jobs in ${feature.properties.ZIP}</b> (${feature.properties.POSTALCITYNAME})`;
                
                // append zip code button to jobList div
                jobList.appendChild(zipDiv);
                
                var jobDiv = document.createElement('div');
                jobDiv.id = feature.properties.ZIP + 'jobs';
                jobDiv.className = 'panel';
                jobList.appendChild(jobDiv);
            },
            style: zipOriginalStyle,
//            interactive: false
        });
            
        map.addLayer(zips);
    });
}

function searchJobs(point){
    
    // using the geometry of the selected point, query the ZipCodesWithJobs feature service to get job information and populate jobs into appropriate zip code divs
    var zipsJobsURL = "https://services3.arcgis.com/9ntQlfNHEhmpX4cl/arcgis/rest/services/ZipCodesWithJobs/FeatureServer/0";
    L.esri.query({
        url: zipsJobsURL
    }).where("OBJECTID > 0").nearby(point, 1609.34).run(function(error, data) {
        L.geoJson(data, {
            onEachFeature: function (feature) {
                
                // define variables to pass to jobDiv function
                if (feature.properties.job_list_JobTitle != undefined){
                    var div = document.getElementById(feature.properties.job_list_ZIP + 'jobs');
                    var id = feature.properties.OBJECTID;
                    var title = feature.properties.job_list_JobTitle;
                    var desc = feature.properties.job_list_Name;
                    var coNumber = feature.properties.job_list_CONumber;
                    var ftpt = feature.properties.job_list_FT_PT;
                    jobDiv(div, id, title, desc, coNumber, ftpt);
                }
            }
        });
    });
}

// function to create individual divs and functionality for each job.
function jobDiv(div, id, title, desc, coNumber, ftpt, wage){
    var jobDiv = document.createElement('div');
    jobDiv.id = `job${id}` + id;
    jobDiv.className = 'job-div';
    jobDiv.onclick = function (){
        $("#" + $(this).children()[1].id).toggle();
    };
    jobDiv.innerHTML += (`<div id="job-title" class="job-title">` +
                            `<img class="icon" src="images/jeffco.png" style="height: 20px">` + 
                            `&nbsp;<b>${title}</b> (${desc})` +
                         `</div>` +
                         `<div id="${coNumber}" class="job-details hidden">` +
                            `<p>&nbsp;&nbsp;CO Number: ${coNumber}<br>` +
                            `&nbsp;&nbsp;FT/PT: ${ftpt}<br>` +
                         `</div><hr>`);
    
    div.appendChild(jobDiv);
}
