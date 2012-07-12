ENV["RAILS_ENV"] ||= 'test'
require File.expand_path("../../../../config/environment", __FILE__)

jasmine_config_overrides = File.expand_path(File.join(File.dirname(__FILE__), 'jasmine_config.rb'))
require jasmine_config_overrides if File.exists?(jasmine_config_overrides)

require 'jasmine-phantomjs'
jasmine_config = Jasmine::PhantomjsConfig.new
spec_builder = Jasmine::SpecBuilder.new(jasmine_config)

should_stop = false

RSpec.configuration.after(:suite) do
  spec_builder.stop if should_stop
end

spec_builder.start
should_stop = true
spec_builder.declare_suites
