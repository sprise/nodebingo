#Node Bingo#

A small NodeJS powered bingo game where squares are filled using popular NPM modules. 

**Features Include**

* A new bingo card generated on every page load
* 50 squares included of popular NPM titles
* Bingo caller for gameplay, a new possible square with every click
* Optional session storage with Redis, to keep from calling duplicate squares
* A click marks a square for gameplay

**Screenshot**

![alt text][logo]
[logo]: http://localhost/nodebingo/screenshot.jpg "Screenshot"

###How to Use###

1. Clone to your directory, eg /var/www/nodebingo
1. Run **npm init**
1. Run **node index.js**
1. Visit localhost:3000 in your browser
1. Optionally, add custom config options

**Dependencies**

This little bingo game relies on npm modules **HapiJS**, **FS**, **Mustache**, **Q**, and **Redis** (but Redis running is not required).

On the frontend **Bootstrap** and **jQuery** are loaded from CDN.
