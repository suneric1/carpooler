# Welcome to Carpooler

Carpooler is a website that helps you find out the best route when you carpool, as you'll need to stop by multiple locations. It uses Google's Distance Matrix API as well as Geocode API.

When you are hanging out with your friends and you need to pick them up, just go to [Carpooler](http:/carpoolerapp.herokuapp.com) and create a new trip, then share the page with your friends. By tapping on "Add", they can easily enter their location which is auto-populated based on GPS. When they're done, you can tap on "Pool" and let Google Maps navigate you with the most timesaving route to pick them up!

### [Link to live website](http://carpoolerapp.herokuapp.com/)

## How it was done

I built the website with Node.js. When you create a new trip, it'll get your geolocation information and send a API request to [http://maps.googleapis.com/maps/api/geocode/json?](http://maps.googleapis.com/maps/api/geocode/json?), which returns the address based on the latitude and longitude. I also provide address autocomplete using the AutoComplete feature of Google Place API [https://maps.googleapis.com/maps/api/place/autocomplete/json?](https://maps.googleapis.com/maps/api/place/autocomplete/json?). When you click on "Pool", all the addresses would be passed to Distance Matrix API, and it returns a matrix of travel time between each spot and another. Based off that, I use some algorithms to find out the least time-consuming route.