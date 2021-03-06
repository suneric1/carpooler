$(function () {
    watchLocation(showPosition);
});

//var startTypingTime = new Date().getTime();
var key = "AIzaSyBN5J7kC4rHwCTkgBJKAjjHecp6cIl-MP0";
var lat, lng;


function autoComplete(obj) {

    var auto_api = "https://maps.googleapis.com/maps/api/place/autocomplete/json?language=en&input=";
    //    startTypingTime = new Date().getTime();
    //        console.log($(obj).val());
    var url = auto_api + $(obj).val() + "&location=" + lat + "," + lng + "&key=" + key;

    console.log(url);

    fetch(url)
        .then(function (response) {
            return response.text();
        }).then(function (text) {
            var addr = JSON.parse(text);
            var suggest = '';
            for (var i = 0; i < addr.predictions.length && i < 4; i++) {
                suggest += '<option value="' + addr.predictions[i].description + '">';
                //                console.log(addr.predictions[i].description);
            }
            $('#' + $(obj).attr('list')).html(suggest);
        });
}

function updateDest(id, obj) {
    var formData = new FormData();
    //    formData.append('id',$(obj).val());
    formData.append('destination', $(obj).val());

    fetch('/update/' + id, {
        method: 'POST',
        body: formData
    }).then(function (res) {
        return res.text();
    }).then(function (text) {
        console.log(text);
    });
}

function watchLocation(successCallback, errorCallback) {
    successCallback = successCallback || function () {};
    errorCallback = errorCallback || function () {};

    // Try HTML5-spec geolocation.
    var geolocation = navigator.geolocation;

    if (geolocation) {
        // We have a real geolocation service.
        try {
            function handleSuccess(position) {
                successCallback(position);
            }

            geolocation.watchPosition(handleSuccess, errorCallback, {
                enableHighAccuracy: true,
                maximumAge: 5000 // 5 sec.
            });
        } catch (err) {
            errorCallback();
        }
    } else {
        errorCallback();
    }
}

function showPosition(position) {
    var addr_api = "https://maps.googleapis.com/maps/api/geocode/json?language=en&latlng=";
    lat = position.coords.latitude;
    lng = position.coords.longitude;
    var url = addr_api + lat + "," + lng;

    fetch(url)
        .then(function (response) {
            return response.text();
        }).then(function (text) {
            var addr = JSON.parse(text);
            if ($('#location').val() == '') {
                $('#location').val(addr.results[0].formatted_address);
            }
        });
}